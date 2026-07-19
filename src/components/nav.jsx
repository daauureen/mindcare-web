import React from 'react';
import { motion } from 'framer-motion';

/**
 * Нижняя навигация.
 *
 * Активная вкладка — не перекрашенная иконка, а «таблетка», которая
 * физически переезжает между разделами (layoutId в framer-motion).
 * Так пользователь видит связь между тем, где он был, и где оказался.
 */
export function BottomNav({ items, active, onChange }) {
  return (
    <nav className="nav">
      {items.map(({ key, label, icon: Icon }) => {
        const on = active === key;
        return (
          <button
            key={key}
            className={on ? 'on' : ''}
            onClick={() => onChange(key)}
            aria-current={on ? 'page' : undefined}
          >
            {on && (
              <motion.span
                layoutId="nav-pill"
                className="pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <motion.span
              className="ico"
              animate={{ y: on ? -1 : 0, scale: on ? 1.06 : 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <Icon size={21} strokeWidth={on ? 2.3 : 1.8} />
            </motion.span>
            <span className="cap">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
