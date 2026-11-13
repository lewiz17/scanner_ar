'use strict';

// POST /api/admin/upload-url { cardId, kind, contentType }
// → { url, key } : URL firmada PUT para subir directo del navegador a R2.
// kind: image | video | marker | poster

const auth = require('../../auth');
const r2 = require('../../r2');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../http');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const admin = auth.requireAdmin(req, res);
  if (!admin) return;
  try {
    const body = await readJsonBody(req);
    const { cardId, kind } = body;
    const contentType = body.contentType || 'application/octet-stream';
    if (!cardId || !UUID_RE.test(cardId)) {
      return sendError(res, 400, 'invalid_card_id');
    }
    const key = r2.buildKey(cardId, kind, contentType);
    if (!key) {
      return sendError(res, 400, 'invalid_kind_or_type', {
        message: `Tipo no aceptado para ${kind}: ${contentType}`,
      });
    }
    const url = await r2.presignPut(key, contentType, 900);
    return sendJson(res, 200, { ok: true, url, key });
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
