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
const MODEL = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
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

/**
 * Google переводит ключи Gemini со старого формата (AIza...) на новый,
 * который называется Auth key и начинается с AQ. Авторизуются они по-разному:
 * старый передаётся как ключ API, новый — как bearer-токен. Если перепутать,
 * приходит 401 с жалобой на тип токена, и это выглядит как «неверный ключ»,
 * хотя ключ верный. Поэтому определяем формат по префиксу.
 */
function authHeader(key) {
  return key.startsWith('AQ.')
    ? { Authorization: `Bearer ${key}` }
    : { 'x-goog-api-key': key };
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

  let res;
  try {
    res = await fetch(ENDPOINT(MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(KEY) },
      body: JSON.stringify(body),
    });
  } catch {
    return 'Связь пропала. Попробуйте отправить сообщение ещё раз.';
  }

  if (!res.ok) {
    // 429 — исчерпан бесплатный лимит; отдельная формулировка, чтобы было понятно, что делать
    if (res.status === 429) {
      return 'Сегодня чат недоступен — закончился дневной лимит запросов. Попробуйте завтра или напишите психологу через тест.';
    }
    if ([400, 401, 403].includes(res.status)) {
      return 'Чат не отвечает: похоже, ключ доступа неверный или не активирован.';
    }
    return SOFT_FALLBACK;
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
