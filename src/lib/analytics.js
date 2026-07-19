import { uid, nowISO } from './utils.js';

/**
 * Аналитический слой.
 *
 * Все цифры считаются из той же базы, что показывают экраны, — отдельного
 * хранилища нет. Когда появится бэкенд, эти же функции переезжают на сервер
 * и превращаются в SQL-запросы к таблицам attempts и analytics_events.
 */

const EVENT_CAP = 3000;

/** Записать событие. Возвращает новую базу — вызывать через commit(). */
export function withEvent(db, name, props = {}) {
  const ev = { id: uid(), name, at: nowISO(), ...props };
  return { ...db, events: [ev, ...(db.events || [])].slice(0, EVENT_CAP) };
}

const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * Главный расчёт.
 * scope: 'admin' — вся платформа, 'psych' — только тесты одного психолога.
 */
export function computeMetrics(db, { scope = 'admin', psychologistId = null, days = 14, includeDemo = true } = {}) {
  const from = daysAgo(days - 1);
  const inScope = (a) =>
    (includeDemo || !a.demo) && (scope === 'admin' || a.psychologistId === psychologistId);

  const attempts = (db.attempts || []).filter(inScope);
  const period = attempts.filter((a) => new Date(a.startedAt || a.completedAt) >= from);
  const events = (db.events || []).filter(
    (e) => (includeDemo || !e.demo) && new Date(e.at) >= from
  );

  const tests = (db.tests || []).filter((t) => scope === 'admin' || t.authorId === psychologistId);
  const students = (db.users || []).filter((u) => u.role === 'STUDENT');

  const started = period.length;
  const completed = period.filter((a) => a.status === 'COMPLETED');
  const shared = completed.filter((a) => a.shared);
  const reviewed = shared.filter((a) => a.reviewStatus && a.reviewStatus !== 'NEW');
  const opened = events.filter((e) => e.name === 'test_card_opened').length;

  /* ---------- воронка: главный отчёт продукта ---------- */
  const funnel = [
    { label: 'Открыли карточку теста', value: Math.max(opened, started) },
    { label: 'Начали проходить', value: started },
    { label: 'Дошли до конца', value: completed.length },
    { label: 'Отправили психологу', value: shared.length },
    { label: 'Психолог просмотрел', value: reviewed.length },
  ];

  /* ---------- динамика по дням ---------- */
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    daily.push({
      key,
      label: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      started: period.filter((a) => dayKey(a.startedAt || a.completedAt) === key).length,
      completed: completed.filter((a) => dayKey(a.completedAt) === key).length,
      shared: shared.filter((a) => a.sharedAt && dayKey(a.sharedAt) === key).length,
    });
  }

  /* ---------- разрез по категориям тестов ---------- */
  const byCategory = {};
  completed.forEach((a) => {
    const t = (db.tests || []).find((x) => x.id === a.testId);
    const c = t?.category || 'Без категории';
    byCategory[c] = (byCategory[c] || 0) + 1;
  });
  const categories = Object.entries(byCategory)
    .map(([label, value]) => ({ label, value }))
    .sort((x, y) => y.value - x.value);

  /* ---------- распределение по тяжести результата ----------
     Это самая содержательная метрика для психолога: не «сколько прошли»,
     а «в каком состоянии оказались те, кто прошёл». */
  const buckets = { low: 0, mid: 0, high: 0 };
  completed.forEach((a) => {
    const t = (db.tests || []).find((x) => x.id === a.testId);
    if (!t || !t.ranges?.length) return;
    const idx = t.ranges.findIndex((r) => r.id === a.rangeId);
    if (idx < 0) return;
    const share = t.ranges.length === 1 ? 0 : idx / (t.ranges.length - 1);
    if (share < 0.34) buckets.low++;
    else if (share < 0.67) buckets.mid++;
    else buckets.high++;
  });

  /* ---------- по тестам ---------- */
  const topTests = tests
    .map((t) => {
      const all = period.filter((a) => a.testId === t.id);
      const done = all.filter((a) => a.status === 'COMPLETED');
      const sh = done.filter((a) => a.shared);
      const durations = done
        .filter((a) => a.startedAt && a.completedAt)
        .map((a) => (new Date(a.completedAt) - new Date(a.startedAt)) / 1000);
      return {
        id: t.id,
        title: t.title,
        category: t.category,
        started: all.length,
        completed: done.length,
        completion: pct(done.length, all.length),
        shared: sh.length,
        shareRate: pct(sh.length, done.length),
        avgScore: done.length ? Math.round(done.reduce((s, a) => s + a.totalScore, 0) / done.length) : 0,
        medianSec: median(durations),
      };
    })
    .filter((t) => t.started > 0)
    .sort((a, b) => b.completed - a.completed);

  /* ---------- скорость реакции психологов ---------- */
  const latencies = reviewed
    .filter((a) => a.sharedAt && a.reviewedAt)
    .map((a) => (new Date(a.reviewedAt) - new Date(a.sharedAt)) / 3600000);

  /* ---------- активные пользователи ---------- */
  const activeIn = (n) => {
    const since = daysAgo(n - 1);
    const ids = new Set();
    attempts.filter((a) => new Date(a.startedAt || a.completedAt) >= since).forEach((a) => ids.add(a.studentId));
    (db.events || []).filter((e) => new Date(e.at) >= since && e.userId).forEach((e) => ids.add(e.userId));
    return ids.size;
  };

  /* ---------- возвращаемость ---------- */
  const perStudent = {};
  completed.forEach((a) => { perStudent[a.studentId] = (perStudent[a.studentId] || 0) + 1; });
  const repeatStudents = Object.values(perStudent).filter((n) => n >= 2).length;

  const abandoned = period.filter((a) => a.status === 'IN_PROGRESS').length;

  return {
    period: { days, from: from.toISOString() },
    kpi: {
      students: students.length,
      psychologists: (db.users || []).filter((u) => u.role === 'PSYCHOLOGIST').length,
      approved: (db.users || []).filter((u) => u.profile?.verificationStatus === 'APPROVED').length,
      pending: (db.users || []).filter((u) => u.profile?.verificationStatus === 'PENDING').length,
      publishedTests: tests.filter((t) => t.status === 'PUBLISHED').length,
      started,
      completed: completed.length,
      abandoned,
      shared: shared.length,
      reviewed: reviewed.length,
      completionRate: pct(completed.length, started),
      shareRate: pct(shared.length, completed.length),
      reviewRate: pct(reviewed.length, shared.length),
      dau: activeIn(1),
      wau: activeIn(7),
      mau: activeIn(30),
      aiDialogs: Object.keys(db.chats || {}).length,
      aiMessages: events.filter((e) => e.name === 'ai_message_sent').length,
      crisisTriggers: events.filter((e) => e.name === 'ai_crisis_triggered').length,
      repeatStudents,
      repeatRate: pct(repeatStudents, Object.keys(perStudent).length),
      medianReviewHours: median(latencies.map((h) => Math.round(h))),
      medianTestSec: median(
        completed
          .filter((a) => a.startedAt && a.completedAt)
          .map((a) => (new Date(a.completedAt) - new Date(a.startedAt)) / 1000)
      ),
    },
    funnel,
    daily,
    categories,
    severity: [
      { label: 'Спокойный диапазон', value: buckets.low, color: 'var(--mint)' },
      { label: 'Средний', value: buckets.mid, color: 'var(--sun)' },
      { label: 'Высокий', value: buckets.high, color: 'var(--coral)' },
    ],
    topTests,
  };
}

/* ============================ ВЫГРУЗКА ============================ */

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(';')).join('\n');
}

export function download(filename, text) {
  // BOM нужен, чтобы Excel не ломал кириллицу
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSummary(m) {
  const rows = [['Показатель', 'Значение']];
  const L = {
    students: 'Студентов зарегистрировано',
    psychologists: 'Заявок психологов',
    approved: 'Психологов подтверждено',
    publishedTests: 'Тестов опубликовано',
    started: 'Тестов начато',
    completed: 'Тестов завершено',
    abandoned: 'Брошено на середине',
    shared: 'Результатов отправлено',
    reviewed: 'Результатов просмотрено',
    completionRate: 'Доля доходящих до конца, %',
    shareRate: 'Доля отправленных, %',
    reviewRate: 'Доля просмотренных, %',
    dau: 'Активных за день',
    wau: 'Активных за неделю',
    mau: 'Активных за месяц',
    repeatRate: 'Проходят второй тест, %',
    medianReviewHours: 'Медиана времени до просмотра, ч',
    medianTestSec: 'Медиана времени прохождения, сек',
    aiMessages: 'Сообщений в AI-чате',
    crisisTriggers: 'Срабатываний кризис-экрана',
  };
  Object.entries(L).forEach(([k, label]) => rows.push([label, m.kpi[k]]));
  download(`mindcare-сводка-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
}

export function exportTests(m) {
  const rows = [['Тест', 'Категория', 'Начали', 'Завершили', 'Доходимость %', 'Отправили', 'Доля отправок %', 'Средний балл', 'Медиана времени, сек']];
  m.topTests.forEach((t) =>
    rows.push([t.title, t.category, t.started, t.completed, t.completion, t.shared, t.shareRate, t.avgScore, t.medianSec])
  );
  download(`mindcare-тесты-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
}

export function exportDaily(m) {
  const rows = [['Дата', 'Начато', 'Завершено', 'Отправлено']];
  m.daily.forEach((d) => rows.push([d.key, d.started, d.completed, d.shared]));
  download(`mindcare-динамика-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
}
