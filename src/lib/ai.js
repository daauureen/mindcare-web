// AI-собеседник: системный промпт, кризис-детектор, вызов Gemini API

/* =========================================================================
   Кризис-детектор

   Работает ДО обращения к модели и по простому списку маркеров.
   Это сделано намеренно: правило нельзя «уговорить», оно не зависит
   от доступности сети и срабатывает мгновенно. Модель здесь — второй
   контур, а не первый.

   Список заведомо неполный. Расширять его должен человек с профильным
   образованием, а не разработчик.
   ========================================================================= */
export const CRISIS_WORDS = [
  'не хочу жить', 'покончить', 'суицид', 'убить себя', 'самоубий', 'порезать себя',
  'вскрыть вены', 'смысла жить', 'исчезнуть навсегда', 'меня бьют', 'меня насилу',
  'хочу умереть', 'не вижу выхода',
];
export const isCrisis = (t) => {
  const s = t.toLowerCase();
  return CRISIS_WORDS.some((w) => s.includes(w));
};

export const AI_SYSTEM = `Ты — поддерживающий собеседник в приложении MINDCARE для студентов. Отвечай по-русски, тепло, коротко (3–6 предложений), простым языком.
МОЖНО: выслушать, помочь назвать чувство, предложить простое дыхательное или заземляющее упражнение, предложить пройти тест в приложении, порекомендовать обратиться к психологу.
НЕЛЬЗЯ: ставить диагнозы, называть расстройства, советовать лекарства, обещать конфиденциальность, заменять специалиста.
Не используй списки и заголовки — пиши обычным текстом. Не начинай ответ со слов "Я понимаю".`;

/* =========================================================================
   Gemini

   Ключ берётся из .env (VITE_GEMINI_API_KEY). Прямой вызов из браузера
   допустим ТОЛЬКО при локальной разработке: всё, что начинается с VITE_,
   попадает в собранный бандл и видно в DevTools. В рабочей версии запрос
   уходит на ваш бэкенд, а ключ остаётся на сервере.
   ========================================================================= */
const KEY = import.meta.env?.VITE_GEMINI_API_KEY;
const MODEL = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-3-flash-preview';
const ENDPOINT = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

/**
 * Пороги фильтров ослаблены до BLOCK_ONLY_HIGH.
 *
 * Причина не в желании «снять ограничения», а в специфике темы: разговор про
 * тревогу, бессонницу и усталость на средних порогах регулярно принимается
 * за опасный контент, и студент вместо ответа получает пустоту. Категорию
 * самоповреждения Google не позволяет ослаблять — и это правильно: такие
 * сообщения должен перехватывать кризис-экран, а не модель.
 */
const SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

/** Ответ, когда модель промолчала. Он не должен выглядеть как техническая ошибка. */
const SOFT_FALLBACK =
  'Мне сложно ответить на это как следует. Если сейчас тяжело — это хороший повод поговорить с живым человеком: психологом вашего вуза или тем, кому вы доверяете.';

const NO_KEY =
  'Чат пока не подключён. Добавьте VITE_GEMINI_API_KEY в файл .env и перезапустите dev-сервер.';

/* -------------------------------------------------------------------------
   Авторизация: перебор способов

   Google переводит ключи Gemini со старого формата (AIza) на новый (AQ.),
   и в переходный период разные способы авторизации ведут себя по-разному
   в зависимости от типа ключа и проекта. Источники противоречат друг другу,
   а цена ошибки — 401, неотличимый от неверного ключа.

   Поэтому не угадываем, а пробуем по очереди и запоминаем сработавший
   на время сессии. Три запроса в худшем случае вместо неработающего чата.
   ------------------------------------------------------------------------- */
const AUTH_METHODS = [
  { name: 'header x-goog-api-key', build: (url, key) => ({ url, headers: { 'x-goog-api-key': key } }) },
  { name: 'query ?key=', build: (url, key) => ({ url: `${url}?key=${encodeURIComponent(key)}`, headers: {} }) },
  { name: 'Authorization: Bearer', build: (url, key) => ({ url, headers: { Authorization: `Bearer ${key}` } }) },
];

let working = null; // индекс способа, который уже сработал в этой сессии

/** Читаемое объяснение отказа: что показать студенту и что нужно знать разработчику. */
export function explainRejection(status, message) {
  const m = (message || '').toLowerCase();
  if (m.includes('location is not supported') || m.includes('user location')) {
    return {
      user: 'Чат недоступен: Google не обслуживает Gemini API из вашей страны.',
      dev: 'Регион не поддерживается. Варианты: VPN на время разработки, другой провайдер модели или запрос через собственный бэкенд в поддерживаемом регионе.',
    };
  }
  if (m.includes('api key not valid') || m.includes('api_key_invalid') || m.includes('invalid authentication')) {
    return { user: 'Чат не отвечает: ключ доступа недействителен.', dev: 'Ключ неверный, отозван или удалён. Создайте новый в AI Studio.' };
  }
  if (m.includes('has not been used') || m.includes('is disabled') || m.includes('not enabled')) {
    return { user: 'Чат не отвечает: доступ к Gemini API не включён.', dev: 'В проекте Google Cloud не включён Generative Language API. Включите его и подождите пару минут.' };
  }
  if (m.includes('expired')) {
    return { user: 'Чат не отвечает: срок действия ключа истёк.', dev: 'Создайте новый ключ.' };
  }
  if (m.includes('consumer') || m.includes('billing')) {
    return { user: 'Чат не отвечает: проблема с проектом Google Cloud.', dev: 'Проект отключён, удалён или требует включения биллинга.' };
  }
  if (status === 429) {
    return { user: 'Сегодня чат недоступен — закончился дневной лимит запросов. Попробуйте завтра или напишите психологу через тест.', dev: 'Исчерпана квота бесплатного тарифа.' };
  }
  return { user: 'Чат не отвечает: похоже, ключ доступа неверный или не активирован.', dev: message || `HTTP ${status}` };
}

/**
 * Отправляет историю диалога в Gemini.
 * @param {Array<{role:'user'|'assistant', content:string}>} history
 * @param {string} catalog — список доступных тестов, чтобы модель могла их предложить
 * @returns {Promise<string>} текст ответа (всегда строка, ошибки не пробрасываются наружу)
 */
export async function askAI(history, catalog) {
  if (!KEY) return NO_KEY;

  // Gemini называет роли user и model, а не user и assistant
  const contents = history.slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    systemInstruction: {
      parts: [{ text: `${AI_SYSTEM}\nДоступные тесты в приложении: ${catalog || 'пока нет'}.` }],
    },
    contents,
    safetySettings: SAFETY,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 500,
    },
  };

  const order = working === null
    ? AUTH_METHODS.map((_, i) => i)
    : [working, ...AUTH_METHODS.map((_, i) => i).filter((i) => i !== working)];

  let res = null;
  let last = null;

  for (const idx of order) {
    const { url, headers } = AUTH_METHODS[idx].build(ENDPOINT(MODEL), KEY);
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    } catch {
      return 'Связь пропала. Попробуйте отправить сообщение ещё раз.';
    }

    if (r.ok) { working = idx; res = r; break; }

    const err = await r.json().catch(() => ({}));
    last = { status: r.status, message: err && err.error && err.error.message, method: AUTH_METHODS[idx].name };

    // Только отказ по авторизации имеет смысл повторять другим способом
    if (![400, 401, 403].includes(r.status)) break;
  }

  if (!res) {
    const { user, dev } = explainRejection(last && last.status, last && last.message);
    // Подробности — в консоль браузера: студенту они не нужны, разработчику необходимы
    console.warn(
      '[MINDCARE] Gemini отклонил запрос.\n' +
      `  HTTP: ${last && last.status}\n` +
      `  Последний способ авторизации: ${last && last.method}\n` +
      `  Ответ Google: ${(last && last.message) || '(пусто)'}\n` +
      `  Что это значит: ${dev}`
    );
    return user;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return SOFT_FALLBACK;
  }

  // Запрос целиком отклонён фильтрами
  if (data.promptFeedback?.blockReason) return SOFT_FALLBACK;

  const candidate = data.candidates?.[0];
  if (!candidate) return SOFT_FALLBACK;

  // Ответ оборван фильтром или лимитом токенов
  if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
    return SOFT_FALLBACK;
  }

  const text = (candidate.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();

  return text || SOFT_FALLBACK;
}
