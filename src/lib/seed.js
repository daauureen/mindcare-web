import { uid, nowISO, DISCLAIMER } from './utils.js';

// Демо-данные при первом запуске
export function seedDB() {
  const psyId = uid();
  const t1 = uid(), t2 = uid();
  const q = (text, opts) => ({ id: uid(), text, options: opts.map(([text, score]) => ({ id: uid(), text, score })) });
  const scale4 = (a, b, c, d) => [[a, 0], [b, 1], [c, 2], [d, 3]];
  const freq = () => scale4("Почти никогда", "Иногда", "Часто", "Почти всё время");

  return {
    users: [
      {
        id: "admin-1", role: "ADMIN", fullName: "Администратор", email: "admin@mindcare.kz",
        password: "admin123", status: "ACTIVE", emailVerifiedAt: nowISO(), createdAt: nowISO(),
      },
      {
        id: psyId, role: "PSYCHOLOGIST", fullName: "Айгерим Сарсенова", email: "aigerim@mindcare.kz",
        password: "demo1234", phone: "+7 700 000 00 00", status: "ACTIVE", emailVerifiedAt: nowISO(), createdAt: nowISO(),
        profile: {
          education: "КазНУ им. аль-Фараби, психология, магистр",
          specializations: ["Стресс", "Учёба и выгорание"],
          experienceYears: 7,
          about: "Работаю со студентами: тревога перед сессией, выгорание, сон. Веду группы поддержки.",
          verificationStatus: "APPROVED", verifiedAt: nowISO(), submittedAt: nowISO(), documents: [
            { id: uid(), type: "DIPLOMA", fileName: "диплом_магистра.pdf" },
            { id: uid(), type: "CERTIFICATE", fileName: "сертификат_КПТ.pdf" },
          ],
        },
      },
    ],
    tests: [
      {
        id: t1, authorId: psyId, title: "Уровень учебного стресса",
        description: "Короткий тест о том, как учёба влияет на ваше состояние в последние две недели.",
        category: "Учёба и выгорание", instruction: "Отвечайте про последние две недели, не задумываясь подолгу. Правильных ответов нет.",
        minutes: 4, disclaimer: DISCLAIMER, status: "PUBLISHED", createdAt: nowISO(), publishedAt: nowISO(),
        questions: [
          q("Мне трудно сосредоточиться на учебных задачах", freq()),
          q("Я откладываю дела, хотя понимаю, что сроки горят", freq()),
          q("Я чувствую усталость даже после отдыха", freq()),
          q("Мысли об учёбе мешают мне засыпать", freq()),
          q("Я перестал(а) радоваться тому, что раньше нравилось", freq()),
        ],
        ranges: [
          { id: uid(), min: 0, max: 4, title: "Спокойный фон", text: "Учебная нагрузка сейчас не выбивает вас из равновесия. Это хорошая точка, чтобы сохранять режим сна и отдыха.", rec: "Ничего срочного делать не нужно." },
          { id: uid(), min: 5, max: 9, title: "Заметное напряжение", text: "Стресс присутствует и уже влияет на концентрацию и отдых. Это частое состояние в сессию, но за ним стоит следить.", rec: "Попробуйте разгрузить одну неделю и вернуться к тесту через 14 дней." },
          { id: uid(), min: 10, max: 15, title: "Высокая нагрузка", text: "Ваши ответы описывают состояние, в котором организм долго не выдерживает: усталость, нарушенный сон, потеря интереса.", rec: "Имеет смысл поговорить с психологом. Вы можете отправить этот результат автору теста." },
        ],
      },
      {
        id: t2, authorId: psyId, title: "Как вы спите?",
        description: "Пять вопросов про сон за последний месяц.",
        category: "Сон", instruction: "Вспомните обычную учебную неделю, а не выходные.",
        minutes: 3, disclaimer: DISCLAIMER, status: "PUBLISHED", createdAt: nowISO(), publishedAt: nowISO(),
        questions: [
          q("Я засыпаю дольше 30 минут", freq()),
          q("Я просыпаюсь ночью и не могу уснуть", freq()),
          q("Утром я чувствую себя разбитым(ой)", freq()),
          q("Я сплю меньше 6 часов", freq()),
          q("Днём меня клонит в сон на парах", freq()),
        ],
        ranges: [
          { id: uid(), min: 0, max: 4, title: "Сон в порядке", text: "Серьёзных сбоев режима нет.", rec: "" },
          { id: uid(), min: 5, max: 9, title: "Сон нарушен", text: "Есть признаки недосыпа: долгое засыпание, тяжёлые пробуждения.", rec: "Начните с фиксированного времени подъёма — это работает лучше, чем ранний отбой." },
          { id: uid(), min: 10, max: 15, title: "Стойкие проблемы со сном", text: "Ответы описывают затяжной недосып, который влияет на учёбу и настроение.", rec: "Стоит обсудить это со специалистом." },
        ],
      },
    ],
    attempts: [],
    chats: {},
    notifications: [],
    audit: [],
    events: [],
  };
}

/* =========================================================================
   Демо-данные для дашборда.

   Без них аналитика на первом запуске пустая и показать её нельзя.
   Всё сгенерированное помечено флагом demo: true — в дашборде есть
   переключатель, который эти записи исключает, чтобы не путать
   выдуманные цифры с настоящими.
   ========================================================================= */

const NAMES = ['Айсулу', 'Данияр', 'Мадина', 'Арман', 'Камила', 'Ерлан',
  'Асель', 'Тимур', 'Жанель', 'Нурлан', 'Дана', 'Алишер'];

// Простой генератор с фиксированным зерном: цифры не скачут при каждой перезагрузке
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

export function withDemoData(db) {
  const rand = rng(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const shift = (days, hours = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(9 + hours, Math.floor(rand() * 59), 0, 0);
    return d.toISOString();
  };

  const students = NAMES.map((n, i) => ({
    id: `demo-s${i}`, role: 'STUDENT', fullName: `${n} (демо)`, email: `demo${i}@example.kz`,
    password: 'demo', status: 'ACTIVE', emailVerifiedAt: shift(20), createdAt: shift(20), demo: true,
  }));

  const tests = db.tests.filter((t) => t.status === 'PUBLISHED');
  const attempts = [];
  const events = [];

  for (let d = 20; d >= 0; d--) {
    // к выходным активность падает — так данные выглядят правдоподобно
    const dow = new Date(Date.now() - d * 86400000).getDay();
    const base = dow === 0 || dow === 6 ? 2 : 5;
    const count = base + Math.floor(rand() * 4);

    for (let j = 0; j < count; j++) {
      const test = pick(tests);
      const student = pick(students);
      const startedAt = shift(d, j % 8);
      const finished = rand() < 0.72;

      events.push({ id: uid(), name: 'test_card_opened', at: startedAt, userId: student.id, testId: test.id, demo: true });
      events.push({ id: uid(), name: 'test_started', at: startedAt, userId: student.id, testId: test.id, demo: true });

      const a = {
        id: uid(), studentId: student.id, studentName: student.fullName, testId: test.id, testTitle: test.title,
        psychologistId: test.authorId, status: finished ? 'COMPLETED' : 'IN_PROGRESS',
        answers: [], totalScore: null, rangeId: null,
        startedAt, completedAt: null, shared: false, sharedAt: null, reviewStatus: null, note: '', demo: true,
      };

      if (finished) {
        // баллы смещены к середине шкалы — как в реальных выборках
        const max = test.questions.length * 3;
        const total = Math.max(0, Math.min(max, Math.round((rand() + rand() + rand()) / 3 * max)));
        const range = test.ranges.find((r) => total >= r.min && total <= r.max) || test.ranges[test.ranges.length - 1];
        a.totalScore = total;
        a.rangeId = range.id;
        a.completedAt = new Date(new Date(startedAt).getTime() + (120 + rand() * 240) * 1000).toISOString();
        a.answers = test.questions.map((q) => {
          const opt = q.options[Math.floor(rand() * q.options.length)];
          return { questionId: q.id, questionText: q.text, optionId: opt.id, optionText: opt.text, score: opt.score };
        });
        events.push({ id: uid(), name: 'test_completed', at: a.completedAt, userId: student.id, testId: test.id, demo: true });

        // чем тяжелее результат, тем охотнее делятся — так обычно и бывает
        const idx = test.ranges.findIndex((r) => r.id === range.id);
        const severity = test.ranges.length > 1 ? idx / (test.ranges.length - 1) : 0;
        if (rand() < 0.22 + severity * 0.4) {
          a.shared = true;
          a.sharedAt = a.completedAt;
          a.reviewStatus = 'NEW';
          events.push({ id: uid(), name: 'result_shared', at: a.sharedAt, userId: student.id, testId: test.id, demo: true });

          if (rand() < 0.78 && d > 0) {
            const lag = (2 + rand() * 30) * 3600000;
            a.reviewedAt = new Date(new Date(a.sharedAt).getTime() + lag).toISOString();
            a.reviewStatus = severity > 0.66 && rand() < 0.5 ? 'NEEDS_CONSULT' : 'VIEWED';
            events.push({ id: uid(), name: 'result_viewed', at: a.reviewedAt, userId: test.authorId, testId: test.id, demo: true });
          }
        }
      }
      attempts.push(a);
    }

    // часть студентов открывает карточку и уходит, не начав, — без этого
    // первый шаг воронки выглядит бессмысленным
    const lookers = Math.floor(rand() * 4);
    for (let l = 0; l < lookers; l++) {
      events.push({ id: uid(), name: 'test_card_opened', at: shift(d, l), userId: pick(students).id, testId: pick(tests).id, demo: true });
    }

    if (rand() < 0.6) {
      events.push({ id: uid(), name: 'ai_message_sent', at: shift(d, 5), userId: pick(students).id, demo: true });
    }
  }

  events.push({ id: uid(), name: 'ai_crisis_triggered', at: shift(4, 6), userId: students[3].id, demo: true });

  return {
    ...db,
    users: [...db.users, ...students],
    attempts: [...attempts].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)),
    events: events.sort((a, b) => new Date(b.at) - new Date(a.at)),
  };
}
