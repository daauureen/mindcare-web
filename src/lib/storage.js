import { isSupabaseConfigured, getSupabaseClient, getSupabaseTableName } from './supabase.js';

/**
 * Слой хранения данных.
 *
 * По умолчанию приложение работает через localStorage. Если заданы
 * VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, данные сохраняются в Supabase
 * и одновременно кэшируются в браузере как fallback.
 */

const DB_KEY = 'mindcare:db:v2';
const SESSION_KEY = 'mindcare:session:v2';
const FILE_PREFIX = 'mindcare:doc:';

const read = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, v); return true; } catch (e) { console.error('storage', e); return false; }
};

async function saveToSupabase(key, value) {
  const client = getSupabaseClient();
  if (!client) return false;
  const table = getSupabaseTableName();
  try {
    const normalizedValue = value === null ? null : (typeof value === 'string' ? JSON.parse(value) : value);
    const payload = { key, value: normalizedValue, updated_at: new Date().toISOString() };
    const { error } = await client.from(table).upsert(payload, { onConflict: 'key' });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[supabase] save failed', error.message || error);
    return false;
  }
}

async function readFromSupabase(key) {
  const client = getSupabaseClient();
  if (!client) return null;
  const table = getSupabaseTableName();
  try {
    const { data, error } = await client.from(table).select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  } catch (error) {
    console.error('[supabase] load failed', error.message || error);
    return null;
  }
}

export async function loadDB() {
  const raw = read(DB_KEY);
  let localData = null;
  try { localData = raw ? JSON.parse(raw) : null; } catch { localData = null; }

  if (isSupabaseConfigured()) {
    const remote = await readFromSupabase(DB_KEY);
    if (remote != null) {
      try {
        const parsedRemote = typeof remote === 'string' ? JSON.parse(remote) : remote;
        if (parsedRemote && parsedRemote.users) return parsedRemote;
      } catch { }
    }
  }
  return localData;
}

export async function saveDB(db) {
  const serialized = JSON.stringify(db);
  const localOk = write(DB_KEY, serialized);
  if (isSupabaseConfigured()) {
    const remoteOk = await saveToSupabase(DB_KEY, db);
    return localOk || remoteOk;
  }
  return localOk;
}

export async function loadSession() {
  if (isSupabaseConfigured()) {
    const remote = await readFromSupabase(SESSION_KEY);
    if (remote != null) {
      try { return typeof remote === 'string' ? JSON.parse(remote) : remote; } catch { return null; }
    }
  }
  const raw = read(SESSION_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function saveSession(session) {
  const serialized = session ? JSON.stringify(session) : null;
  if (session) {
    const localOk = write(SESSION_KEY, serialized);
    if (isSupabaseConfigured()) {
      const remoteOk = await saveToSupabase(SESSION_KEY, session);
      return localOk || remoteOk;
    }
    return localOk;
  }
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { console.error(e); }
  if (isSupabaseConfigured()) {
    await saveToSupabase(SESSION_KEY, null);
  }
  return true;
}

/** Файлы хранятся отдельными ключами, чтобы не раздувать основную базу. */
export async function putFile(id, dataUrl) {
  return write(FILE_PREFIX + id, dataUrl);
}

export async function getFile(id) {
  return read(FILE_PREFIX + id);
}

export async function deleteFile(id) {
  try { localStorage.removeItem(FILE_PREFIX + id); } catch (e) { console.error(e); }
}

/** Полный сброс — удобно при демонстрациях. */
export async function resetAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('mindcare:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) { console.error(e); }
}
