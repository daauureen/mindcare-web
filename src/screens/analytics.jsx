import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Target, Send, Eye, CalendarRange, Users, FileText,
  MessageCircleHeart, AlertTriangle, Download, Repeat,
} from 'lucide-react';
import { Top } from '../components/common.jsx';
import { KPI, Ring, Funnel, LineChart, BarsH, Donut, TestTable, PALETTE } from '../components/charts.jsx';
import { Item, Stagger, EASE } from '../components/motion.jsx';
import { computeMetrics, exportSummary, exportTests, exportDaily } from '../lib/analytics.js';

/**
 * Дашборд. Один компонент на две роли:
 *  - админ видит всю платформу;
 *  - психолог видит только свои тесты.
 *
 * Порядок блоков не случайный: сначала «здоровье» продукта (кольца и воронка),
 * потом динамика, и только потом объёмы. Абсолютные цифры без доходимости
 * ничего не говорят, поэтому они внизу.
 */
export function Analytics({ db, scope = 'admin', psychologistId = null }) {
  const [days, setDays] = useState(14);
  const [includeDemo, setIncludeDemo] = useState(true);

  const m = useMemo(
    () => computeMetrics(db, { scope, psychologistId, days, includeDemo }),
    [db, scope, psychologistId, days, includeDemo]
  );

  const hasDemo = (db.attempts || []).some((a) => a.demo);
  const k = m.kpi;

  return (
    <>
      <Top title={scope === 'admin' ? 'Аналитика' : 'Мои тесты в цифрах'} />
      <div className="body">
        <Stagger>

          {/* ---------- период ---------- */}
          <Item>
            <div className="row" style={{ gap: 8 }}>
              <CalendarRange size={17} color="var(--soft)" />
              {[7, 14, 30].map((d) => (
                <button key={d} className={'chip' + (days === d ? ' on' : '')} onClick={() => setDays(d)}>
                  {d} дней
                </button>
              ))}
            </div>
          </Item>

          {hasDemo && (
            <Item style={{ marginTop: 14 }}>
              <button
                className={'card demo-toggle' + (includeDemo ? ' on' : '')}
                onClick={() => setIncludeDemo(!includeDemo)}
                style={{ padding: 16 }}
              >
                <span className="sw">
                  <motion.span
                    className="knob"
                    animate={{ x: includeDemo ? 17 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  Демо-данные {includeDemo ? 'учитываются' : 'скрыты'}
                  <span className="tiny" style={{ display: 'block', fontWeight: 400 }}>
                    Выключите перед показом настоящих цифр
                  </span>
                </span>
              </button>
            </Item>
          )}

          {/* ---------- здоровье продукта ---------- */}
          <Item style={{ marginTop: 20 }}>
            <div className="card">
              <h3>Как работает продукт</h3>
              <p className="tiny" style={{ marginTop: 4 }}>Три доли, по которым видно, живая платформа или нет</p>
              <div className="rings" style={{ marginTop: 20 }}>
                <Ring value={k.completionRate} caption="доходят до конца"
                  color={k.completionRate >= 65 ? PALETTE.MINT : PALETTE.BUTTER} />
                <Ring value={k.shareRate} caption="отправляют" color={PALETTE.LAV} />
                <Ring value={k.reviewRate} caption="просмотрено" color={PALETTE.MINT} />
              </div>
              <p className="tiny" style={{ marginTop: 16 }}>
                Ориентиры пилота: доходимость от 65%, отправка от 30%, просмотр от 80% в течение двух суток.
                Сейчас медиана до просмотра — <b>{k.medianReviewHours} ч</b>.
              </p>
            </div>
          </Item>

          {/* ---------- ключевые цифры ---------- */}
          <Item style={{ marginTop: 20 }}>
            <div className="kpi-grid">
              <KPI label="Тестов завершено" value={k.completed} accent="berry" icon={Target} hint={`начато ${k.started}`} />
              <KPI label="Отправлено психологу" value={k.shared} accent="sun" icon={Send} hint={`${k.shareRate}% от завершённых`} />
              <KPI label="Просмотрено" value={k.reviewed} accent="mint" icon={Eye} hint={`медиана ${k.medianReviewHours} ч`} />
              <KPI label="Прошли 2+ теста" value={k.repeatRate} suffix="%" accent="berry" icon={Repeat} hint={`${k.repeatStudents} человек`} />
            </div>
          </Item>

          {/* ---------- воронка ---------- */}
          <Item style={{ marginTop: 20 }}>
            <div className="card">
              <h3>Воронка</h3>
              <p className="tiny" style={{ marginTop: 4, marginBottom: 20 }}>
                Где студенты отваливаются. Самый честный отчёт о продукте.
              </p>
              <Funnel steps={m.funnel} />
              {k.abandoned > 0 && (
                <p className="tiny" style={{ marginTop: 18 }}>
                  Брошено на середине: <b>{k.abandoned}</b>. Если это больше трети начатых — тесты слишком длинные.
                </p>
              )}
            </div>
          </Item>

          {/* ---------- динамика ---------- */}
          <Item style={{ marginTop: 20 }}>
            <div className="card">
              <div className="between">
                <h3>Динамика</h3>
                <TrendingUp size={18} color="var(--soft)" />
              </div>
              <div style={{ marginTop: 18 }}>
                <LineChart
                  data={m.daily}
                  series={[
                    { key: 'started', label: 'начато', color: PALETTE.LAV_L },
                    { key: 'completed', label: 'завершено', color: PALETTE.LAV },
                    { key: 'shared', label: 'отправлено', color: PALETTE.MINT },
                  ]}
                />
              </div>
            </div>
          </Item>

          {/* ---------- состояние студентов ---------- */}
          <Item style={{ marginTop: 20 }}>
            <div className="card">
              <h3>В каком состоянии студенты</h3>
              <p className="tiny" style={{ marginTop: 4, marginBottom: 18 }}>
                Распределение по диапазонам результата. Это важнее количества прохождений:
                показывает, находит ли платформа тех, кому нужна помощь.
              </p>
              <Donut parts={m.severity} />
            </div>
          </Item>

          {/* ---------- темы ---------- */}
          <Item style={{ marginTop: 20 }}>
            <div className="card">
              <h3>Популярные темы</h3>
              <div style={{ marginTop: 18 }}>
                <BarsH items={m.categories} />
              </div>
            </div>
          </Item>

          {/* ---------- по тестам ---------- */}
          <Item style={{ marginTop: 20 }}>
            <div className="card">
              <h3>По тестам</h3>
              <div style={{ marginTop: 14 }}>
                <TestTable rows={m.topTests} />
              </div>
            </div>
          </Item>

          {/* ---------- аудитория ---------- */}
          <Item style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 14 }}>Аудитория</h3>
            <div className="kpi-grid">
              <KPI label="Активны за день" value={k.dau} accent="berry" icon={Users} />
              <KPI label="За неделю" value={k.wau} accent="berry" icon={Users} />
              <KPI label="За месяц" value={k.mau} accent="berry" icon={Users} />
              <KPI label="Сообщений в чате" value={k.aiMessages} accent="mint" icon={MessageCircleHeart} hint={`диалогов ${k.aiDialogs}`} />
            </div>
          </Item>

          {scope === 'admin' && (
            <Item style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 14 }}>Платформа</h3>
              <div className="kpi-grid">
                <KPI label="Студентов" value={k.students} accent="sun" icon={Users} />
                <KPI label="Психологов" value={k.approved} accent="sun" icon={Users} hint={`на проверке ${k.pending}`} />
                <KPI label="Тестов в ленте" value={k.publishedTests} accent="sun" icon={FileText} />
                <KPI label="Начато тестов" value={k.started} accent="berry" icon={Target} />
              </div>

              {k.crisisTriggers > 0 && (
                <div className="card alert" style={{ marginTop: 14 }}>
                  <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={20} color="var(--ochre)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <h3>Кризис-экран сработал: {k.crisisTriggers}</h3>
                      <p className="tiny" style={{ marginTop: 6 }}>
                        Эти события нужно просматривать вручную каждый день.
                        Цифра не для отчётности — за ней стоят живые люди.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Item>
          )}

          {/* ---------- выгрузка ---------- */}
          <Item style={{ marginTop: 24 }}>
            <div className="card">
              <div className="row" style={{ gap: 10 }}>
                <Download size={18} color="var(--soft)" />
                <h3 style={{ flex: 1 }}>Выгрузка</h3>
              </div>
              <p className="tiny" style={{ marginTop: 8, marginBottom: 16 }}>
                Файлы CSV открываются в Excel и Google Таблицах. Имён студентов и их ответов в выгрузке нет.
              </p>
              <div className="stack">
                <button className="btn ghost" onClick={() => exportSummary(m)}>Сводка по показателям</button>
                <button className="btn ghost" onClick={() => exportTests(m)}>Разрез по тестам</button>
                <button className="btn ghost" onClick={() => exportDaily(m)}>Динамика по дням</button>
              </div>
            </div>
          </Item>

        </Stagger>
      </div>
    </>
  );
}
