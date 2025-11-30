import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// 📌 Bot principal
const BOT_TOKEN = process.env.APIKEY;
const CHAT_ID = process.env.CHATID;

// 📌 Bot secundario
const SECONDARY_BOT_TOKEN = process.env.APIKEY2;
const SECONDARY_CHAT_ID = process.env.CHATID2;

app.use(cors());
app.use(express.json());

// Mejorar la función para escapar caracteres especiales de HTML
function escapeHTML(str) {
  // Solo escapamos <, > y & para que Telegram pueda interpretarlos como texto dentro de <pre>
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Formatea el body para que se vea bien dentro de la etiqueta <pre>
function formatBody(body) {
  if (!body || typeof body !== 'object') return '(body vacío)';

  let formatted = '';
  for (const key in body) {
    const value = body[key];
    const cleanKey = escapeHTML(key); // Escapamos la clave
    let cleanValue;

    if (typeof value === 'object') {
      // Si es un objeto, lo stringify y lo escapamos para mostrarlo
      cleanValue = escapeHTML(JSON.stringify(value, null, 2));
    } else {
      // Si es otro valor simple, lo escapamos y lo convertimos a string
      cleanValue = escapeHTML(String(value));
    }
    
    // Usamos indentación simple
    formatted += `  - ${cleanKey}: ${cleanValue}\n`;
  }

  return formatted.trim();
}

/* Enviar a Telegram */
async function sendToTelegram(token, chatId, message) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: message,
    // ¡Usamos 'HTML' para que Telegram interprete el formato!
    parse_mode: 'HTML', 
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Error telegram:', text);
    throw new Error('Telegram error');
  }
}

/* Obtener país desde IP */
async function getCountryFromIP(ip) {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/country_name/`);
    if (!response.ok) return 'Desconocido';
    const country = await response.text();
    return country || 'Desconocido';
  } catch {
    return 'Desconocido';
  }
}

/* ENDPOINT PRINCIPAL */
app.post('/send', async (req, res) => {
  // obtener IP del request
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    req.ip;

  const cleanIP = ip.replace('::ffff:', '');
  const country = await getCountryFromIP(cleanIP);

  const bodyFormatted = formatBody(req.body);

  // 📌 Mensaje final con formato HTML:
  const message = `
<b>📩 Nuevo mensaje recibido</b>

<b>📦 Body:</b>
<pre>${bodyFormatted || '(body vacío)'}</pre>

<b>📍 Información de Conexión:</b>
País: <code>${escapeHTML(country)}</code>
IP: <code>${escapeHTML(cleanIP)}</code>
  `.trim(); // Usamos <code> para IP y País, y <b> para títulos

  try {
    // enviar al primer bot
    await sendToTelegram(BOT_TOKEN, CHAT_ID, message);

    // enviar al segundo bot
    await sendToTelegram(SECONDARY_BOT_TOKEN, SECONDARY_CHAT_ID, message);

    res.json({ ok: true });
  } catch (err) {
    console.error('Error enviando:', err);
    res.status(500).json({ error: 'No se pudo enviar el mensaje' });
  }
});

/* SERVIDOR */
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});
