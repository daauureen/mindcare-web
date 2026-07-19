// Отправка email через EmailJS (прямой fetch, без npm-пакета)

const PUBLIC_KEY = import.meta.env?.VITE_EMAILJS_PUBLIC_KEY;
const SERVICE_ID = import.meta.env?.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env?.VITE_EMAILJS_TEMPLATE_ID;

/**
 * Отправляет код подтверждения на почту.
 * @param {string} email — адрес получателя
 * @param {string} code — шестизначный код
 * @returns {Promise<boolean>} true если отправилось
 */
export async function sendEmailCode(email, code) {
  // Если ключи не настроены — просто логируем и возвращаем true для разработки
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    console.warn('[email] EmailJS не настроен. Код:', code, 'для', email);
    return true;
  }

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        accessToken: PUBLIC_KEY,
        template_params: {
          to_email: email,
          code: code,
        },
      }),
    });

    if (res.ok) {
      console.log('[email] Код отправлен на', email);
      return true;
    }

    const text = await res.text();
    console.error('[email] Ошибка отправки:', text);
    return false;
  } catch (err) {
    console.error('[email] Ошибка:', err.message);
    return false;
  }
}