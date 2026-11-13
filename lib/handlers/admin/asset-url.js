'use strict';

// POST /api/admin/asset-url { cardId, kind }
// → { url } : URL firmada GET (5 min) para ver/descargar un archivo de la
// tarjeta en el panel (miniaturas, kit de imprenta §5.5).

const db = require('../../db');
const auth = require('../../auth');
const r2 = require('../../r2');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../http');

const KIND_TO_FIELD = {
  image: 'image_key',
  marker: 'marker_key',
  video: 'video_key',
  poster: 'poster_key',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const admin = auth.requireAdmin(req, res);
  if (!admin) return;
  try {
    const body = await readJsonBody(req);
    const field = KIND_TO_FIELD[body.kind];
    if (!field) return sendError(res, 400, 'invalid_kind');
    const store = db.createNeonStore();
    const card = await store.getCardById(body.cardId);
    if (!card) return sendError(res, 404, 'card_not_found');
    const key = card[field];
    if (!key) return sendError(res, 404, 'asset_not_found');
    const url = await r2.presignGet(key, 300);
    return sendJson(res, 200, { ok: true, url, key });
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
