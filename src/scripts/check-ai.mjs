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
const model = env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

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

const authHeader = key.startsWith('AQ.') ? { Authorization: `Bearer ${key}` } : { 'x-goog-api-key': key };
console.log(`${DIM}  авторизация: ${Object.keys(authHeader)[0]}${RESET}`);
console.log(`${DIM}  модель из .env: ${model}${RESET}\n`);

/* ---------- 3. список доступных моделей ---------- */
let available = [];
try {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: authHeader });
  const data = await r.json().catch(() => ({}));

  if (r.status === 401 || r.status === 403) {
    bad(`Ключ отклонён (${r.status})`);
    hint(data?.error?.message || 'Ключ недействителен, отозван или ещё не активирован');
    hint('Создайте новый на https://aistudio.google.com/apikey');
    process.exit(1);
  }
  if (!r.ok) {
    bad(`Список моделей недоступен (HTTP ${r.status})`);
    hint(data?.error?.message || 'неизвестная ошибка');
    process.exit(1);
  }

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
  bad('Не удалось связаться с Google');
  hint(e.message);
  hint('Проверьте интернет, VPN, корпоративный прокси или блокировку домена googleapis.com');
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
  bad('Запрос не прошёл');
  hint(e.message);
  process.exit(1);
}
