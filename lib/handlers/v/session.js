'use strict';

// POST /api/v/session { slug }
// Valida que la tarjeta esté activa y con cupo, y devuelve el token de
// sesión firmado de la experiencia (§6.2).

const db = require('../../db');
const { checkSessionAllowed } = require('../../cards');
const { createExperienceSession, isBotUserAgent } = require('../../session');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readJsonBody(req);
  const slug = body.slug || (req.query && req.query.slug);
  if (!slug) return sendError(res, 400, 'slug_required');
  if (isBotUserAgent(req.headers && req.headers['user-agent'])) {
    return sendError(res, 403, 'bot_detected');
  }
  try {
    const store = db.createNeonStore();
    const card = await store.getCardBySlug(slug);
    if (!card) return sendError(res, 404, 'card_not_found');
    const check = checkSessionAllowed(card);
    if (!check.ok) {
      return sendError(res, 409, 'card_not_available', { status: check.status });
    }
    const { token } = createExperienceSession({ cardId: card.id, slug: card.slug });
    return sendJson(res, 200, { ok: true, token });
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
