'use strict';

// Tokens firmados con HMAC-SHA256 (sin dependencias).
// Formato: base64url(JSON) + "." + base64url(firma)
// Se usa para la sesión del invitado (experiencia) y para la cookie del admin.

const crypto = require('node:crypto');

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno SESSION_SECRET');
  return secret;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signToken(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const encoded = base64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest();
  return `${encoded}.${base64url(sig)}`;
}

// Devuelve el payload si la firma es válida y no expiró; null en otro caso.
function verifyToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest();
  let given;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < nowSeconds) {
    return null;
  }
  return payload;
}

// ---------- Sesión de experiencia (invitado) ----------

const EXPERIENCE_SESSION_TTL_SECONDS = 30 * 60; // 30 minutos

// payload: { typ:'exp', cardId, slug, sid }
function createExperienceSession({ cardId, slug }, secret = getSessionSecret()) {
  const sid = crypto.randomUUID();
  const token = signToken(
    { typ: 'exp', cardId, slug, sid },
    secret,
    EXPERIENCE_SESSION_TTL_SECONDS,
  );
  return { token, sid };
}

function verifyExperienceSession(token, secret = getSessionSecret()) {
  const payload = verifyToken(token, secret);
  if (!payload || payload.typ !== 'exp' || !payload.sid || !payload.cardId) {
    return null;
  }
  return payload;
}

// Hash anónimo del identificador de dispositivo que guarda el navegador.
// Nunca se guarda el identificador en claro (§6.2: privacidad).
function hashDeviceId(deviceId, secret = getSessionSecret()) {
  if (!deviceId || typeof deviceId !== 'string') return null;
  return crypto
    .createHmac('sha256', secret)
    .update(`device:${deviceId}`)
    .digest('hex');
}

// Detección básica de bots/crawlers para no quemar cupo (§6.2).
const BOT_UA_PATTERN =
  /bot|crawler|spider|crawling|prefetch|preview|facebookexternalhit|whatsapp\/2|slurp|bingpreview|headless/i;

function isBotUserAgent(userAgent) {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}

// Clase de dispositivo agregada para estadísticas (§5.6), sin datos personales.
function deviceClassFromUA(userAgent) {
  if (!userAgent) return 'otro';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  if (/android/i.test(userAgent)) return 'android';
  return 'otro';
}

module.exports = {
  getSessionSecret,
  signToken,
  verifyToken,
  createExperienceSession,
  verifyExperienceSession,
  hashDeviceId,
  isBotUserAgent,
  deviceClassFromUA,
  EXPERIENCE_SESSION_TTL_SECONDS,
};
