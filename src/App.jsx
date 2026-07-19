import React, { useState, useEffect, useCallback, useRef } from 'react';
import { loadDB, saveDB, saveSession, loadSession } from './lib/storage.js';
import { seedDB, withDemoData } from './lib/seed.js';
import { probeSupabaseWrite } from './lib/supabase.js';
import { seedSupabaseFromAppData } from './lib/supabaseSeed.js';
import { Auth, VerifyEmail } from './screens/auth.jsx';
import { StudentApp } from './screens/student.jsx';
import { PsychApp } from './screens/psychologist.jsx';
import { AdminApp } from './screens/admin.jsx';
import { Background, Toast, ScreenSkeleton, Page } from './components/motion.jsx';

function clearStaleSession() {
  try {
    localStorage.removeItem('mindcare:session:v2');
  } catch (error) {
    console.warn('[storage] failed to clear session', error);
  }
}

export default function App() {
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(null);
  const [route, setRoute] = useState({ n: 'welcome' });
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true); // <-- флаг загрузки

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
    d.chats = d.chats || {};
    d.notifications = d.notifications || [];
    await saveDB(d);

    let seeded = { ok: false, reason: 'seed_skipped' };
    try {
      seeded = await seedSupabaseFromAppData();
    } catch (error) {
      console.warn('[supabase] seed failed', error?.message || error);
    }
    console.info('[supabase] seed', seeded);

    // Всегда начинаем с экрана входа
    dbRef.current = d;
    setDb(d);
    setSession(null);
    setLoading(false);
    setRoute({ n: 'welcome' });
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
    setSession(s); 
    await saveSession(s); // <-- сохраняем сессию
    go('home');
    return null;
  };
  
  const logout = async () => { 
    setSession(null); 
    await saveSession(null); // <-- удаляем сессию
    go('welcome'); 
  };

  const refresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 450));
    const d = await loadDB();
    if (d) { 
      d.chats = d.chats || {};
      d.notifications = d.notifications || [];
      dbRef.current = d; 
      setDb(d); 
    }
  }, []);

  const shell = (children) => (
    <div className="mc">
      <Background />
      <div className="frame">{children}</div>
    </div>
  );

  if (loading || !db) return shell(<ScreenSkeleton />);

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

  const key = `${me ? me.role : 'guest'}:${route.n}:${route.id || ''}`;

  return shell(
    <>
      <Page k={key}>{screen}</Page>
      <Toast text={toast} />
    </>
  );
}