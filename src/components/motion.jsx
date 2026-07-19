import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, useInView } from 'framer-motion';

/**
 * Анимационные примитивы.
 *
 * Правило по всему приложению: движение подсказывает иерархию и связь
 * между экранами, но не развлекает. Длительности 0.2–0.4 c, ease-out,
 * без отскоков — иначе интерфейс начинает выглядеть игрушечным.
 *
 * Всё уважает prefers-reduced-motion: framer-motion сам сокращает
 * длительности, а CSS дублирует это правило в конце index.css.
 */

export const EASE = [0.22, 0.61, 0.36, 1];

/* ---------- переход между экранами ----------
   Сознательно без AnimatePresence с mode="wait": там новый экран монтируется
   только после того, как отыграет exit старого. Если анимация по любой причине
   не завершится, приложение застрянет на предыдущем экране. Здесь новый экран
   появляется сразу, а анимация — только на входе. Дешевле визуально,
   зато переход не может «зависнуть». */
export function Page({ children, k, dir = 1 }) {
  return (
    <motion.div
      key={k}
      initial={{ opacity: 0, x: 16 * dir }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- появление блоков по очереди ---------- */
export function Stagger({ children, delay = 0, gap = 0.05 }) {
  return (
    <motion.div
      initial="hide"
      animate="show"
      variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      style={{ display: 'contents' }}
    >
      {children}
    </motion.div>
  );
}

export const itemVariants = {
  hide: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE } },
};

export function Item({ children, className = '', ...rest }) {
  return (
    <motion.div variants={itemVariants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/* ---------- нажатие ----------
   Оборачивает любой элемент: лёгкое сжатие при тапе, подъём при наведении. */
export function Press({ children, scale = 0.97, lift = true, ...rest }) {
  return (
    <motion.div
      whileTap={{ scale }}
      whileHover={lift ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      style={{ display: 'contents' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Кнопка с эффектом нажатия. Пропсы совпадают с обычной button. */
export function Btn({ className = 'btn', children, ...p }) {
  return (
    <motion.button
      className={className}
      whileTap={p.disabled ? undefined : { scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...p}
    >
      {children}
    </motion.button>
  );
}

/* ---------- анимированный счётчик ---------- */
export function Counter({ value, duration = 0.9, suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('ru-RU'));
  const [text, setText] = useState('0');

  useEffect(() => { if (inView) spring.set(value); }, [inView, value, spring]);
  useEffect(() => rounded.on('change', setText), [rounded]);

  return <span ref={ref}>{text}{suffix}</span>;
}

/* ---------- скелетоны ---------- */
export const Skeleton = ({ h = 16, w = '100%', r = 10, style }) => (
  <div className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />
);

export function CardSkeleton() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={20} w="42%" r={999} />
      <Skeleton h={22} w="78%" />
      <Skeleton h={14} w="94%" />
      <Skeleton h={14} w="60%" />
    </div>
  );
}

export function ScreenSkeleton() {
  return (
    <div className="body stack" aria-busy="true" aria-label="Загрузка">
      <Skeleton h={13} w={110} />
      <Skeleton h={30} w="62%" />
      <div style={{ height: 6 }} />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

/* ---------- тост ---------- */
export function Toast({ text, tone = 'ok' }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          className="toast"
          initial={{ opacity: 0, y: 20, x: '-50%', scale: 0.94 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: 12, x: '-50%', scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 500, damping: 20 }}
            style={{ display: 'grid', placeItems: 'center' }}
          >
            {tone === 'ok' ? <CheckMark /> : null}
          </motion.span>
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CheckMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,.16)" />
      <motion.path
        d="M7.5 12.4l3 3 6-6.4" stroke="#fff" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ delay: 0.14, duration: 0.32, ease: EASE }}
      />
    </svg>
  );
}

/* ---------- успех после важного действия ---------- */
export function SuccessBurst({ show, title, subtitle, onDone }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onDone && onDone(), 1700);
    return () => clearTimeout(t);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center',
            background: 'rgba(251,247,242,.86)', backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.86, y: 10 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            style={{ textAlign: 'center', padding: 32 }}
          >
            <motion.div
              style={{
                width: 92, height: 92, borderRadius: '50%', margin: '0 auto 20px',
                background: 'linear-gradient(135deg,#9C8DFA,#6D5CE0)', display: 'grid', placeItems: 'center',
                boxShadow: '0 18px 40px -16px rgba(109,92,224,.7)',
              }}
              initial={{ rotate: -12 }} animate={{ rotate: 0 }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <motion.path
                  d="M6 12.5l4 4 8-8.5" stroke="#fff" strokeWidth="2.4"
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ delay: 0.12, duration: 0.4, ease: EASE }}
                />
              </svg>
            </motion.div>
            <h2>{title}</h2>
            {subtitle && <p className="muted" style={{ marginTop: 8 }}>{subtitle}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- живой фон ----------
   Три пастельных пятна, очень медленно дрейфующие. Амплитуда намеренно
   маленькая: фон должен ощущаться, а не замечаться. */
export function Background() {
  const blobs = [
    { c: 'rgba(139,124,246,.30)', size: 320, top: '-8%', left: '-22%', dur: 26, dx: 26, dy: 18 },
    { c: 'rgba(245,194,107,.28)', size: 260, top: '18%', left: '68%', dur: 32, dx: -22, dy: 24 },
    { c: 'rgba(111,201,174,.22)', size: 300, top: '68%', left: '-14%', dur: 38, dx: 30, dy: -20 },
  ];
  return (
    <div className="bg" aria-hidden="true">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="blob"
          style={{ width: b.size, height: b.size, top: b.top, left: b.left, background: b.c }}
          animate={{ x: [0, b.dx, 0], y: [0, b.dy, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: b.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ---------- pull to refresh ---------- */
export function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef(null);
  const ref = useRef(null);
  const THRESHOLD = 68;

  const onStart = (e) => {
    if (!ref.current || ref.current.scrollTop > 2 || busy) return;
    startY.current = e.touches[0].clientY;
  };
  const onMove = (e) => {
    if (startY.current == null) return;
    const d = e.touches[0].clientY - startY.current;
    if (d > 0) setPull(Math.min(96, d * 0.45));
  };
  const onEnd = async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= THRESHOLD) {
      setBusy(true);
      await onRefresh();
      setBusy(false);
    }
    setPull(0);
  };

  return (
    <div
      ref={ref}
      className="scroll"
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
    >
      <motion.div className="ptr" animate={{ height: busy ? 46 : pull }} transition={{ duration: 0.18 }}>
        <motion.div
          animate={{ rotate: busy ? 360 : pull * 3, opacity: pull > 8 || busy ? 1 : 0 }}
          transition={busy ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0.15 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 12a9 9 0 1 1-3-6.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </motion.div>
      </motion.div>
      {children}
    </div>
  );
}
