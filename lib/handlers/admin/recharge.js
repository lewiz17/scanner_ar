'use strict';

// POST /api/admin/cards/:id/recharge
// { packLabel, viewsAdded, priceCharged, note } → suma cupo y lo registra (§4.4)

const auth = require('../../auth');
const db = require('../../db');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const admin = auth.requireAdmin(req, res);
  if (!admin) return;
  const id = req.query && (req.query.id || req.query['[id]']);
  if (!id) return sendError(res, 400, 'id_required');
  try {
    const body = await readJsonBody(req);
    const viewsAdded = Math.floor(Number(body.viewsAdded));
    if (!Number.isFinite(viewsAdded) || viewsAdded <= 0) {
      return sendError(res, 400, 'invalid_views', {
        message: 'viewsAdded debe ser un entero mayor que cero.',
      });
    }
    const result = await db.addRecharge(id, {
      packLabel: body.packLabel || `${viewsAdded} vistas`,
      viewsAdded,
      priceCharged: Number(body.priceCharged) || 0,
      note: body.note || '',
    });
    if (!result) return sendError(res, 404, 'card_not_found');
    return sendJson(res, 200, {
      ok: true,
      quota_total: result.quotaTotal,
      views_used: result.viewsUsed,
      remaining: Math.max(0, result.quotaTotal - result.viewsUsed),
    });
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
