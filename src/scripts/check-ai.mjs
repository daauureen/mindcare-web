/**
 * Проверка подключения AI-чата.
 *
 * Запуск:  npm run check-ai
 *
 * Скрипт читает .env, обращается к Gemini напрямую и говорит, где именно
 * сломалось: не найден файл, не тот формат ключа, недоступна модель,
 * исчерпан лимит или нет сети. Браузер и React в этой цепочке не участвуют,
 * поэтому результат однозначный.
 */

import fs from 'fs';
import path from 'path';

const RESET = '\x1b[0m', RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', DIM = '\x1b[2m';
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const bad = (m) => console.log(`${RED}✗${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}!${RESET} ${m}`);
const hint = (m) => console.log(`${DIM}  → ${m}${RESET}`);

console.log('\nПроверка подключения AI-чата\n' + '─'.repeat(46));

/* ---------- расшифровка сетевых ошибок ----------
   fetch в Node прячет настоящую причину в error.cause. Без неё в консоли
   видно только «fetch failed», по которому диагноз поставить нельзя. */
function explainNetwork(e) {
  const cause = e.cause || {};
  const code = cause.code || e.code || '';
  const map = {
    ENOTFOUND: 'адрес googleapis.com не разрешается через DNS — домен блокируется или нет сети',
    EAI_AGAIN: 'сбой DNS — часто это отсутствие сети или подмена DNS провайдером',
    ECONNREFUSED: 'соединение отклонено — обычно файрвол или прокси',
    ECONNRESET: 'соединение разорвано на середине — типично для фильтрующего прокси',
    ETIMEDOUT: 'истекло время ожидания — запрос молча гасится файрволом',
    UND_ERR_CONNECT_TIMEOUT: 'истекло время подключения — запрос молча гасится файрволом',
    CERT_HAS_EXPIRED: 'просрочен сертификат на стороне перехватывающего прокси',
    SELF_SIGNED_CERT_IN_CHAIN: 'корпоративный прокси подменяет сертификаты, Node ему не доверяет',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'корпоративный прокси подменяет сертификаты, Node ему не доверяет',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'корпоративный прокси подменяет сертификаты, Node ему не доверяет',
  };
  return { code, text: map[code] || cause.message || e.message };
}

/** Отдельно проверяем, есть ли интернет вообще: это разделяет
    «сети нет» и «сеть есть, но именно Google недоступен». */
async function probe(url) {
  try {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 8000);
    await fetch(url, { method: 'HEAD', signal: c.signal });
    clearTimeout(timer);
    return true;
  } catch { return false; }
}

async function networkReport(e) {
  const { code, text } = explainNetwork(e);
  bad('Не удалось связаться с Google');
  hint(text + (code ? ` (${code})` : ''));

  const proxies = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']
    .filter((v) => process.env[v]);
  if (proxies.length) {
    warn(`Заданы переменные прокси: ${proxies.join(', ')}`);
    hint('Node их сам не использует, в отличие от браузера — поэтому скрипт падает, а браузер может работать');
    hint('Node 24 и новее: запустите с NODE_USE_ENV_PROXY=1 npm run check-ai');
  }

  const inet = await probe('https://example.com');
  const google = await probe('https://www.google.com');
  console.log();
  console.log(`  интернет вообще: ${inet ? 'есть' : 'недоступен'}`);
  console.log(`  google.com:      ${google ? 'доступен' : 'недоступен'}`);
  console.log();

  if (!inet) {
    hint('Похоже, сети нет совсем или всё закрыто прокси. Начните с подключения к интернету.');
  } else if (String(code).includes('CERT') || String(code).includes('SIGN')) {
    hint('Рабочий ноутбук с корпоративным антивирусом или прокси — частая причина.');
    hint('Спросите у системного администратора корневой сертификат и укажите путь к нему:');
    hint('NODE_EXTRA_CA_CERTS=C:\\path\\to\\ca.pem npm run check-ai');
  } else {
    hint('Сеть есть, но домен googleapis.com не открывается: вероятны корпоративный файрвол, VPN или антивирус.');
    hint('Проверьте вручную — откройте в браузере https://generativelanguage.googleapis.com');
  }

  console.log();
  console.log(`${YELLOW}Важно:${RESET} Node и браузер ходят в сеть по-разному. Браузер использует`);
  console.log('системный прокси и системные сертификаты, а Node — нет. Поэтому запустите');
  console.log('npm run dev и проверьте чат: вполне возможно, что в браузере он работает.');
}



/* ---------- 1. файл .env ---------- */
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  bad('Файл .env не найден');
  hint('Выполните: cp .env.example .env');
  hint(`Он должен лежать здесь: ${envPath}`);
  const strays = fs.readdirSync('.').filter((f) => f.toLowerCase().startsWith('.env'));
  if (strays.length) hint(`Рядом есть: ${strays.join(', ')} — возможно, файл назван неверно`);
  process.exit(1);
}
ok('Файл .env найден');

/* ---------- 2. переменная с ключом ---------- */
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

let key = env.VITE_GEMINI_API_KEY;
const model = env.VITE_GEMINI_MODEL || 'gemini-3-flash-preview';

if (!key) {
  if ('VITE_GEMINI_API_KEY' in env) {
    bad('Переменная VITE_GEMINI_API_KEY есть, но значение пустое');
    hint('Ключ нужно вписать сразу после знака равенства, в той же строке');
  } else {
    bad('Переменная VITE_GEMINI_API_KEY не найдена в .env');
    const similar = Object.keys(env).filter((k) => /gemini|api|key/i.test(k));
    if (similar.length) hint(`Есть похожие имена: ${similar.join(', ')} — имя должно совпадать точно`);
  }
  hint('Строка должна выглядеть так (без кавычек и пробелов вокруг знака равенства):');
  hint('VITE_GEMINI_API_KEY=AQ.Ab8...');
  process.exit(1);
}

if (/^["']|["']$/.test(env.VITE_GEMINI_API_KEY || '')) warn('Ключ был в кавычках — убрал их, но лучше записать без них');
if (key.includes(' ')) { warn('В ключе есть пробел — скорее всего, он попал при копировании'); key = key.replace(/\s/g, ''); }

const kind = key.startsWith('AQ.') ? 'новый (Auth key)' : key.startsWith('AIza') ? 'прежний (Standard key)' : 'неизвестный';
ok(`Ключ найден: ${key.slice(0, 6)}…${key.slice(-4)}, формат ${kind}`);
if (kind === 'неизвестный') {
  warn('Ключ не похож ни на AQ., ни на AIza — проверьте, что скопирован именно ключ Gemini API');
}

const METHODS = [
  { name: 'header x-goog-api-key', build: (url) => ({ url, headers: { 'x-goog-api-key': key } }) },
  { name: 'query ?key=', build: (url) => ({ url: `${url}?key=${encodeURIComponent(key)}`, headers: {} }) },
  { name: 'Authorization: Bearer', build: (url) => ({ url, headers: { Authorization: `Bearer ${key}` } }) },
];
console.log(`${DIM}  модель из .env: ${model}${RESET}\n`);

/** Пробует все способы авторизации и возвращает первый рабочий. */
async function tryAuth(url, init = {}) {
  let last = null;
  for (const m of METHODS) {
    const { url: u, headers } = m.build(url);
    const r = await fetch(u, { ...init, headers: { ...(init.headers || {}), ...headers } });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, data, method: m.name };
    last = { ok: false, status: r.status, data, method: m.name };
    if (![400, 401, 403].includes(r.status)) break;
  }
  return last;
}
let authHeader = {};

/* ---------- 3. список доступных моделей ---------- */
let available = [];
try {
  const res = await tryAuth('https://generativelanguage.googleapis.com/v1beta/models');

  if (!res.ok) {
    bad(`Google отклонил запрос (HTTP ${res.status})`);
    hint(`Дословный ответ: ${res.data?.error?.message || '(пусто)'}`);
    const msg = (res.data?.error?.message || '').toLowerCase();
    if (msg.includes('location')) {
      hint('Регион не поддерживается — Gemini API недоступен из вашей страны.');
      hint('Обходные пути: VPN на время разработки, другой провайдер или запрос через свой бэкенд.');
    } else if (msg.includes('has not been used') || msg.includes('disabled')) {
      hint('В проекте не включён Generative Language API. Включите его в Google Cloud Console.');
    } else {
      hint('Создайте новый ключ на https://aistudio.google.com/apikey');
    }
    hint(`Проверены все способы авторизации, последний: ${res.method}`);
    process.exit(1);
  }
  const data = res.data;
  authHeader = METHODS.find((m) => m.name === res.method).build('x').headers;
  console.log(`${DIM}  рабочий способ авторизации: ${res.method}${RESET}`);

  available = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace('models/', ''));

  ok(`Ключ принят. Доступно моделей: ${available.length}`);

  if (!available.includes(model)) {
    bad(`Модель "${model}" вашему ключу недоступна`);
    const flash = available.filter((m) => m.includes('flash') && !m.includes('image') && !m.includes('tts'));
    hint(`Впишите в .env одну из этих: ${(flash.length ? flash : available).slice(0, 5).join(', ')}`);
    hint('VITE_GEMINI_MODEL=<имя модели>');
    process.exit(1);
  }
  ok(`Модель "${model}" доступна`);
} catch (e) {
  await networkReport(e);
  process.exit(1);
}

/* ---------- 4. настоящий запрос ---------- */
try {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Отвечай одним коротким предложением по-русски.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Скажи, что связь работает.' }] }],
      generationConfig: { maxOutputTokens: 100 },
    }),
  });
  const data = await r.json().catch(() => ({}));

  if (r.status === 429) {
    bad('Дневной лимит бесплатного тарифа исчерпан');
    hint('Лимиты сбрасываются в полночь по тихоокеанскому времени');
    process.exit(1);
  }
  if (!r.ok) {
    bad(`Запрос отклонён (HTTP ${r.status})`);
    hint(data?.error?.message || 'неизвестная ошибка');
    process.exit(1);
  }

  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) {
    warn('Модель ответила пустотой');
    hint(`Причина: ${data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'неизвестна'}`);
    process.exit(1);
  }

  ok('Модель ответила');
  console.log(`${DIM}  «${text}»${RESET}`);
  console.log('\n' + '─'.repeat(46));
  console.log(`${GREEN}Всё работает.${RESET} Если в браузере чат по-прежнему молчит —`);
  console.log('перезапустите dev-сервер: Vite читает .env только при старте.\n');
} catch (e) {
  await networkReport(e);
  process.exit(1);
}
