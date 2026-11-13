'use strict';

// GET /api/v/asset?slug=...&kind=marker|video|poster&token=...
// Verifica sesión válida + tarjeta activa + cupo disponible y redirige
// (302) a la URL firmada de R2 que expira en 60 s (§6.3). Los bytes nunca
// pasan por esta función (regla de oro de §9).

const db = require('../../db');
const r2 = require('../../r2');
const { effectiveStatus } = require('../../cards');
const { verifyExperienceSession } = require('../../session');
const { sendError, methodNotAllowed } = require('../../http');

const KIND_TO_FIELD = {
  marker: 'marker_key',
  video: 'video_key',
  poster: 'poster_key',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const { slug, kind, token } = req.query || {};
  const field = KIND_TO_FIELD[kind];
  if (!slug || !field) return sendError(res, 400, 'invalid_asset_request');

  const session = verifyExperienceSession(token || '');
  if (!session || session.slug !== slug) {
    return sendError(res, 401, 'invalid_session');
  }

  try {
    const store = db.createNeonStore();
    const card = await store.getCardById(session.cardId);
    if (!card || card.slug !== slug) return sendError(res, 404, 'card_not_found');
    if (effectiveStatus(card) !== 'activa') {
      return sendError(res, 409, 'card_not_available');
    }
    const key = card[field];
    if (!key) return sendError(res, 404, 'asset_not_found');
    const url = await r2.presignGet(key, 60);
    res.statusCode = 302;
    res.setHeader('Location', url);
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
