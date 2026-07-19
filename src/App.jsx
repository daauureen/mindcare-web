import React, { useState, useEffect, useCallback, useRef } from 'react';
import { loadDB, saveDB, loadSession, saveSession } from './lib/storage.js';
import { seedDB, withDemoData } from './lib/seed.js';
import { probeSupabaseWrite } from './lib/supabase.js';
import { seedSupabaseFromAppData } from './lib/supabaseSeed.js';
import { Auth, VerifyEmail } from './screens/auth.jsx';
import { StudentApp } from './screens/student.jsx';
import { PsychApp } from './screens/psychologist.jsx';
import { AdminApp } from './screens/admin.jsx';
import { Background, Toast, ScreenSkeleton, Page } from './components/motion.jsx';

/**
 * Корневой компонент: хранит базу, сессию и маршрут, раздаёт их экранам по ролям.
 * Логика не изменилась — добавлены только оболочки представления:
 * фон, переходы между экранами, скелетон загрузки и pull-to-refresh.
 */
export default function App() {
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(null);
  const [route, setRoute] = useState({ n: 'welcome' });
  const [toast, setToast] = useState('');

  // Актуальная база вне цикла рендера. Нужна там, где действие сразу после
  // commit() читает данные: например, регистрация создаёт пользователя и тут же
  // логинит его — из состояния его ещё не видно, из ref видно.
  const dbRef = useRef(null);

  useEffect(() => {
    (async () => {
      const probe = await probeSupabaseWrite();
      console.info('[supabase] probe', probe);
      let d = await loadDB();
      if (!d) {
        d = withDemoData(seedDB());
      } else {
        d = withDemoData({ ...d, users: d.users || [], tests: d.tests || [], attempts: d.attempts || [], events: d.events || [] });
      }
      await saveDB(d);
      const seeded = await seedSupabaseFromAppData();
      console.info('[supabase] seed', seeded);
      const s = await loadSession();
      dbRef.current = d;
      setDb(d);
      if (s && d.users.some((u) => u.id === s.userId)) { setSession(s); setRoute({ n: 'home' }); }
    })();
  }, []);

  const commit = (next) => { dbRef.current = next; setDb(next); saveDB(next); };
  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const go = (n, params = {}) => setRoute({ n, ...params });

  const me = db && session ? db.users.find((u) => u.id === session.userId) : null;

  const login = async (email, password) => {
    const source = dbRef.current || db;
    const u = source.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) return 'Неверный email или пароль';
    if (u.status === 'BLOCKED') return 'Аккаунт заблокирован администратором';
    const s = { userId: u.id };
    setSession(s); await saveSession(s); go('home');
    return null;
  };
  const logout = async () => { setSession(null); await saveSession(null); go('welcome'); };

  // Перечитывает базу с диска — полезно, когда приложение открыто в двух вкладках
  const refresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 450));
    const d = await loadDB();
    if (d) { dbRef.current = d; setDb(d); }
  }, []);

  const shell = (children) => (
    <div className="mc">
      <Background />
      <div className="frame">{children}</div>
    </div>
  );

  if (!db) return shell(<ScreenSkeleton />);

  let screen;
  if (!me) {
    screen = <Auth db={db} commit={commit} route={route} go={go} login={login} notify={notify} />;
  } else if (!me.emailVerifiedAt) {
    screen = <VerifyEmail me={me} db={db} commit={commit} logout={logout} notify={notify} />;
  } else if (me.role === 'ADMIN') {
    screen = <AdminApp me={me} refresh={refresh} db={db} commit={commit} route={route} go={go} notify={notify} logout={logout} />;
  } else if (me.role === 'PSYCHOLOGIST') {
    screen = <PsychApp me={me} refresh={refresh} db={db} commit={commit} route={route} go={go} notify={notify} logout={logout} />;
  } else {
    screen = <StudentApp me={me} refresh={refresh} db={db} commit={commit} route={route} go={go} notify={notify} logout={logout} />;
  }

  // Ключ перехода: смена роли или экрана перерисовывает содержимое с анимацией,
  // но нижняя навигация внутри экранов остаётся на месте.
  const key = `${me ? me.role : 'guest'}:${route.n}:${route.id || ''}`;

  return shell(
    <>
      <Page k={key}>{screen}</Page>
      <Toast text={toast} />
    </>
  );
}
