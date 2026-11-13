'use strict';

// GET  /api/admin/cards → lista con saldo y estadísticas básicas (§5.2/§5.6)
// POST /api/admin/cards → crea la tarjeta (los archivos ya están en R2)

const auth = require('../../lib/auth');
const db = require('../../lib/db');
const r2 = require('../../lib/r2');
const { effectiveStatus, remainingOf } = require('../../lib/cards');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../lib/http');

async function decorate(card, req) {
  const out = { ...card };
  out.remaining = remainingOf(card);
  out.effective_status = effectiveStatus(card);
  out.low_quota =
    out.effective_status === 'activa' &&
    (out.remaining <= 10 || out.remaining <= Math.ceil(card.quota_total * 0.1));
  if (card.poster_key && r2.isR2Configured()) {
    try {
      out.poster_url = await r2.presignGet(card.poster_key, 600);
    } catch {
      out.poster_url = null;
    }
  }
  return out;
}

module.exports = async function handler(req, res) {
  const admin = auth.requireAdmin(req, res);
  if (!admin) return;
  try {
    if (req.method === 'GET') {
      const rows = await db.listCardsWithStats();
      const cards = [];
      for (const row of rows) cards.push(await decorate(row, req));
      return sendJson(res, 200, { ok: true, cards });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.title || !String(body.title).trim()) {
        return sendError(res, 400, 'title_required');
      }
      const settings = await db.getSettings();
      const card = await db.createCard({
        ...body,
        title: String(body.title).trim(),
        quota_total:
          body.quota_total !== undefined && body.quota_total !== ''
            ? body.quota_total
            : settings.default_quota,
        validity_months: settings.validity_months,
      });
      return sendJson(res, 201, { ok: true, card: await decorate(card, req) });
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
