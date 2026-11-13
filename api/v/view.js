'use strict';

// POST /api/v/view { slug, token, mode, deviceId }
// Registra la vista según §6: una por sesión, deduplicación por
// dispositivo y decremento atómico del cupo.

const db = require('../../lib/db');
const { registerView } = require('../../lib/cards');
const {
  verifyExperienceSession,
  hashDeviceId,
  isBotUserAgent,
  deviceClassFromUA,
} = require('../../lib/session');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readJsonBody(req);
  const slug = body.slug || (req.query && req.query.slug);
  if (!slug || !body.token) return sendError(res, 400, 'slug_and_token_required');

  const ua = req.headers && req.headers['user-agent'];
  if (isBotUserAgent(ua)) {
    return sendJson(res, 200, { ok: false, counted: false, reason: 'bot' });
  }

  const session = verifyExperienceSession(body.token);
  if (!session || session.slug !== slug) {
    return sendError(res, 401, 'invalid_session');
  }

  try {
    const store = db.createNeonStore();
    const card = await store.getCardById(session.cardId);
    if (!card || card.slug !== slug) return sendError(res, 404, 'card_not_found');
    const settings = await db.getSettings();
    const result = await registerView(store, {
      card,
      sessionId: session.sid,
      mode: body.mode === '2d' ? '2d' : 'ar',
      deviceClass: deviceClassFromUA(ua),
      deviceHash: body.deviceId ? hashDeviceId(String(body.deviceId)) : null,
      dedupeMinutes: settings.dedupe_minutes,
    });
    return sendJson(res, 200, {
      ok: result.ok,
      counted: Boolean(result.counted),
      reason: result.reason || null,
      remaining: result.remaining,
    });
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
