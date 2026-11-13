'use strict';

// GET /api/admin/settings → ajustes del negocio (§5.4)
// PUT /api/admin/settings → guarda los ajustes enviados

const auth = require('../../lib/auth');
const db = require('../../lib/db');
const { sendJson, sendError, readJsonBody, methodNotAllowed } = require('../../lib/http');

module.exports = async function handler(req, res) {
  const admin = auth.requireAdmin(req, res);
  if (!admin) return;
  try {
    if (req.method === 'GET') {
      const settings = await db.getSettings();
      return sendJson(res, 200, { ok: true, settings });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readJsonBody(req);
      const settings = await db.updateSettings(body.settings || body);
      return sendJson(res, 200, { ok: true, settings });
    }
    return methodNotAllowed(res, ['GET', 'PUT']);
  } catch (err) {
    return sendError(res, 500, 'server_error', { message: String((err && err.message) || err) });
  }
};
