'use strict';

// GET    /api/admin/cards/:id → detalle + historial de recargas
// PATCH  /api/admin/cards/:id → editar campos, cambiar estado,
//          ajuste manual de cupo { quota_adjust: { views, note } }
// DELETE /api/admin/cards/:id → borrado definitivo (+ limpieza en R2)

const auth = require('../../auth');
const db = require('../../db');
const r2 = require('../../r2');
const { effectiveStatus, remainingOf } = require('../../cards');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../http');

function cardId(req) {
  return (req.query && (req.query.id || req.query['[id]'])) || null;
}

module.exports = async function handler(req, res) {
  const admin = auth.requireAdmin(req, res);
  if (!admin) return;
  const id = cardId(req);
  if (!id) return sendError(res, 400, 'id_required');
  try {
    const store = db.createNeonStore();
    const card = await store.getCardById(id);
    if (!card) return sendError(res, 404, 'card_not_found');

    if (req.method === 'GET') {
      const recharges = await db.listRecharges(id);
      return sendJson(res, 200, {
        ok: true,
        card: {
          ...card,
          remaining: remainingOf(card),
          effective_status: effectiveStatus(card),
        },
        recharges,
      });
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      let result = null;
      if (body.quota_adjust && Number(body.quota_adjust.views)) {
        result = await db.addRecharge(id, {
          packLabel: 'Ajuste manual',
          viewsAdded: Number(body.quota_adjust.views),
          priceCharged: 0,
          note: body.quota_adjust.note || '',
        });
        if (!result) return sendError(res, 404, 'card_not_found');
      }
      const { quota_adjust, ...fields } = body;
      const updated = await db.updateCard(id, fields);
      if (!updated) return sendError(res, 404, 'card_not_found');
      return sendJson(res, 200, {
        ok: true,
        card: {
          ...updated,
          remaining: remainingOf(updated),
          effective_status: effectiveStatus(updated),
        },
      });
    }

    if (req.forceArchive) {
      const updated = await db.updateCard(id, { status: 'archivada' });
      return sendJson(res, 200, { ok: true, card: updated });
    }

    // El borrado también llega por POST /cards/:id/delete: en el despliegue
    // de Vercel del proyecto, el método DELETE recibe un 404 de plataforma
    // antes de llegar a esta función (visto el 2026-11-14).
    if (req.method === 'DELETE' || req.forceDelete) {
      const deleted = await db.deleteCard(id);
      if (!deleted) return sendError(res, 404, 'card_not_found');
      // Limpieza de archivos en R2 (best-effort: la tarjeta ya se borró).
      try {
        const keys = [
          deleted.image_key, deleted.marker_key, deleted.video_key,
          deleted.poster_key, deleted.model_key,
        ];
        let layers = deleted.layers;
        if (typeof layers === 'string') {
          try { layers = JSON.parse(layers); } catch { layers = []; }
        }
        if (Array.isArray(layers)) {
          layers.forEach((l) => { if (l && l.key) keys.push(l.key); });
        }
        for (const key of keys) {
          if (key) await r2.deleteObject(key);
        }
      } catch { /* la limpieza no bloquea el borrado */ }
      return sendJson(res, 200, { ok: true, deleted: true });
    }

    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
