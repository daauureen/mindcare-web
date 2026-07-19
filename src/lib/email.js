const PUBLIC_KEY = import.meta.env?.VITE_EMAILJS_PUBLIC_KEY;
const SERVICE_ID = import.meta.env?.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env?.VITE_EMAILJS_TEMPLATE_ID;

export async function sendEmailCode(email, code) {
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
          email: email,
          to_email: email,
          to_name: email.split('@')[0],
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