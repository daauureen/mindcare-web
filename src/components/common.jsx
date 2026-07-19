import React, { useState, useId } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import { EASE, Press, Item } from './motion.jsx';

/**
 * Базовые элементы интерфейса.
 * API компонентов намеренно не менялось — экраны используют их как раньше.
 */

/* ---------- поле с плавающей подписью ---------- */
function FloatField({ label, as = 'input', value, onChange, ...p }) {
  const [focus, setFocus] = useState(false);
  const id = useId();
  const filled = value !== undefined && value !== null && String(value).length > 0;
  const up = focus || filled;
  const Tag = as;

  return (
    <div className={'field' + (up ? ' up' : '')}>
      <Tag
        id={id}
        className="ctrl"
        value={value}
        onChange={onChange}
        onFocus={(e) => { setFocus(true); p.onFocus && p.onFocus(e); }}
        onBlur={(e) => { setFocus(false); p.onBlur && p.onBlur(e); }}
        placeholder={up ? p.placeholder : ''}
        {...p}
      />
      <label className="lbl" htmlFor={id}>{label}</label>
    </div>
  );
}

export const Field = (props) => <FloatField as="input" {...props} />;
export const Area = (props) => <FloatField as="textarea" {...props} />;

/** Select с той же плавающей подписью. */
export function Select({ label, children, ...p }) {
  return (
    <div className="field up">
      <select className="ctrl" {...p}>{children}</select>
      <label className="lbl">{label}</label>
      <ChevronDown size={17} className="chev" />
    </div>
  );
}

/* ---------- шапка экрана ---------- */
export const Top = ({ title, onBack, right }) => (
  <motion.div
    className="top"
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: EASE }}
  >
    {onBack && (
      <Press scale={0.9} lift={false}>
        <button className="back" onClick={onBack} aria-label="Назад">
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
      </Press>
    )}
    <h2 style={{ flex: 1, minWidth: 0 }}>{title}</h2>
    {right}
  </motion.div>
);

/* ---------- пустое состояние ----------
   Мягкая абстрактная иллюстрация: конкретные картинки в теме
   психологической поддержки слишком легко считываются как оценка. */
export function Empty({ children, title }) {
  return (
    <motion.div
      className="empty"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <EmptyArt />
      {title && <h3>{title}</h3>}
      <div>{children}</div>
    </motion.div>
  );
}

function EmptyArt() {
  return (
    <svg width="132" height="108" viewBox="0 0 132 108" fill="none" style={{ margin: '0 auto 20px', display: 'block' }}>
      <motion.ellipse
        cx="66" cy="92" rx="42" ry="7" fill="rgba(38,33,46,.05)"
        animate={{ rx: [42, 38, 42] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.g
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <rect x="30" y="20" width="72" height="62" rx="20" fill="#F1EEFE" />
        <rect x="42" y="36" width="34" height="6" rx="3" fill="#CFC5FB" />
        <rect x="42" y="50" width="48" height="6" rx="3" fill="#E2DBFC" />
        <rect x="42" y="64" width="26" height="6" rx="3" fill="#E2DBFC" />
        <circle cx="97" cy="26" r="11" fill="#FEF4E2" />
        <circle cx="97" cy="26" r="4" fill="#F5C26B" />
      </motion.g>
    </svg>
  );
}

/* ---------- шкала результата ----------
   Единственный элемент, который показывает не только «где ты»,
   но и всю шкалу целиком: без этого результат читается как приговор. */
export function ScoreScale({ ranges, score, activeId }) {
  return (
    <div className="scale">
      <div className="bar">
        {ranges.map((r, i) => (
          <motion.div
            key={r.id}
            className={'seg' + (r.id === activeId ? ' here' : '')}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.34, ease: EASE }}
          >
            {r.title}
          </motion.div>
        ))}
      </div>
      <div className="ends">
        <span className="tiny">{ranges[0].min} баллов</span>
        <motion.span
          className="tiny"
          style={{ fontWeight: 600, color: 'var(--ink)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        >
          ваш результат: {score}
        </motion.span>
        <span className="tiny">{ranges[ranges.length - 1].max}</span>
      </div>
    </div>
  );
}

/* ---------- профиль ---------- */
export function Profile({ me, go, logout, extra }) {
  const roleLabel = { STUDENT: 'Студент', PSYCHOLOGIST: 'Психолог', ADMIN: 'Администратор' }[me.role];
  const initials = me.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('');

  return (
    <>
      <Top title="Профиль" />
      <div className="body stack">
        <Item>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{
                width: 58, height: 58, borderRadius: 20, flexShrink: 0,
                background: 'linear-gradient(135deg,#A99BFB,#7A6BF0)', color: '#fff',
                display: 'grid', placeItems: 'center', fontFamily: 'var(--display)',
                fontSize: 21, fontWeight: 700, boxShadow: 'var(--sh-lav)',
              }}
            >
              {initials}
            </motion.div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.fullName}</h3>
              <p className="tiny" style={{ marginTop: 4 }}>{me.email}</p>
              <span className="tag" style={{ marginTop: 8 }}>{roleLabel}</span>
            </div>
          </div>
        </Item>

        {extra}

        <div className="divider" />
        <div className="row" style={{ gap: 8, color: 'var(--soft)' }}>
          <ShieldCheck size={16} />
          <p className="tiny">Политика конфиденциальности · Пользовательское соглашение</p>
        </div>
        <button className="btn quiet" onClick={logout}>
          <LogOut size={17} /> Выйти
        </button>
      </div>
    </>
  );
}
