import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Counter, EASE } from './motion.jsx';

/**
 * Графики на чистом SVG.
 *
 * Библиотеку не берём сознательно: нужно пять типов диаграмм со своей
 * пастельной палитрой, а любой чарт-пакет пришлось бы перекрашивать
 * дольше, чем нарисовать это руками. Плюс сборка остаётся лёгкой.
 *
 * Все диаграммы анимируются один раз при попадании в экран — данные
 * должны «собираться» на глазах, но не мигать при каждой прокрутке.
 */

const LAV = '#8B7CF6';
const LAV_L = '#C4BBFB';
const MINT = '#6FC9AE';
const BUTTER = '#F5C26B';
const ROSE = '#EE8F84';

/* ---------- карточка показателя ---------- */
export function KPI({ label, value, hint, accent = 'berry', suffix = '', icon: Icon }) {
  const numeric = typeof value === 'number';
  return (
    <motion.div
      className={'kpi ' + accent}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {Icon && <div className="ico-wrap"><Icon size={18} strokeWidth={2.1} /></div>}
      <div className="kpi-value">
        {numeric ? <Counter value={value} suffix={suffix} /> : <>{value}{suffix}</>}
      </div>
      <div className="kpi-label">{label}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </motion.div>
  );
}

/* ---------- кольцо прогресса ---------- */
export function Ring({ value, max = 100, size = 96, stroke = 9, color = LAV, label, caption }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = Math.max(0, Math.min(1, value / max));

  return (
    <div className="ring-item" ref={ref}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - c * share : c }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          fontFamily="var(--display)" fontSize={size * 0.24} fontWeight="800" fill="var(--ink)"
        >
          {label ?? `${Math.round(share * 100)}%`}
        </text>
      </svg>
      {caption && <div className="ring-cap">{caption}</div>}
    </div>
  );
}

/* ---------- воронка ---------- */
export function Funnel({ steps }) {
  const top = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div>
      {steps.map((s, i) => {
        const prev = i === 0 ? null : steps[i - 1].value;
        const drop = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : 0;
        return (
          <div key={s.label} className="funnel-row">
            <div className="funnel-head">
              <span>{s.label}</span>
              <b><Counter value={s.value} /></b>
            </div>
            <div className="funnel-track">
              <motion.div
                className="funnel-fill"
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.max(3, (s.value / top) * 100)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.85, ease: EASE, delay: i * 0.09 }}
              />
            </div>
            {i > 0 && (
              <div className={'funnel-drop' + (drop >= 50 ? ' bad' : '')}>
                {drop > 0 ? `− ${drop}% на этом шаге` : 'потерь нет'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- линейный график с заливкой ---------- */
export function LineChart({ data, series }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const W = 320, H = 128, PAD = 6;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key])));
  const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(1, data.length - 1);
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2);

  const path = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[key])}`).join(' ');
  const area = (key) => `${path(key)} L${x(data.length - 1)},${H} L${x(0)},${H} Z`;

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H + 20}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {[0.5, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={H - (H - PAD * 2) * g - PAD} y2={H - (H - PAD * 2) * g - PAD}
            stroke="var(--line)" strokeWidth="1" />
        ))}

        {series.map((s, si) => (
          <g key={s.key}>
            <motion.path
              d={area(s.key)} fill={`url(#grad-${s.key})`}
              initial={{ opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }}
              transition={{ duration: 0.7, delay: 0.5 + si * 0.1 }}
            />
            <motion.path
              d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: inView ? 1 : 0 }}
              transition={{ duration: 1.1, ease: EASE, delay: si * 0.12 }}
            />
            {data.map((d, i) =>
              d[s.key] === max && max > 0 ? (
                <motion.circle
                  key={i} cx={x(i)} cy={y(d[s.key])} r="3.6" fill="#fff" stroke={s.color} strokeWidth="2.4"
                  initial={{ scale: 0 }} animate={{ scale: inView ? 1 : 0 }}
                  transition={{ delay: 1.05, type: 'spring', stiffness: 400, damping: 20 }}
                />
              ) : null
            )}
          </g>
        ))}

        {data.map((d, i) =>
          i % Math.ceil(data.length / 4) === 0 || i === data.length - 1 ? (
            <text key={'t' + i} x={x(i)} y={H + 14} textAnchor="middle" fontSize="10" fill="var(--soft)">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- горизонтальные полосы ---------- */
export function BarsH({ items, color = LAV }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="tiny">Пока нет данных.</p>;
  return (
    <div>
      {items.map((it, i) => (
        <div key={it.label} className="barsh-row">
          <div className="barsh-label">{it.label}</div>
          <div className="barsh-track">
            <motion.div
              className="barsh-fill"
              style={{ background: it.color || color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(it.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.75, ease: EASE, delay: i * 0.07 }}
            />
          </div>
          <b>{it.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------- кольцевая диаграмма ---------- */
export function Donut({ parts }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 44, SW = 15, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="donut-wrap" ref={ref}>
      <svg viewBox="0 0 120 120" width="126" height="126" style={{ flexShrink: 0 }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" strokeWidth={SW} />
        {total > 0 && parts.map((p, i) => {
          const len = (p.value / total) * C;
          const el = (
            <motion.circle
              key={p.label} cx="60" cy="60" r={R} fill="none" stroke={p.color} strokeWidth={SW}
              strokeDasharray={`${len} ${C - len}`}
              initial={{ strokeDashoffset: -offset, opacity: 0 }}
              animate={{ strokeDashoffset: -offset, opacity: inView ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.12 }}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="60" y="56" textAnchor="middle" fontFamily="var(--display)" fontSize="23" fontWeight="800" fill="var(--ink)">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="9.5" fill="var(--soft)">прохождений</text>
      </svg>
      <div className="donut-legend">
        {parts.map((p, i) => (
          <motion.div
            key={p.label}
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 + i * 0.09 }}
          >
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <b>{total ? Math.round((p.value / total) * 100) : 0}%</b>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------- таблица по тестам ---------- */
export function TestTable({ rows }) {
  if (!rows.length) return <p className="tiny">За выбранный период тесты никто не проходил.</p>;
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr><th>Тест</th><th>Нач.</th><th>Заверш.</th><th>Дох.</th><th>Отпр.</th></tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <motion.tr
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <td>
                <b>{t.title}</b>
                <div className="tiny">ср. балл {t.avgScore} · {Math.round(t.medianSec / 60) || '<1'} мин</div>
              </td>
              <td>{t.started}</td>
              <td>{t.completed}</td>
              <td className={t.completion < 50 ? 'bad' : t.completion >= 65 ? 'good' : ''}>{t.completion}%</td>
              <td>{t.shareRate}%</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PALETTE = { LAV, LAV_L, MINT, BUTTER, ROSE };
