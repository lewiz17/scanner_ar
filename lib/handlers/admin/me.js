'use strict';

// GET /api/admin/me → estado de la sesión + estado de inicialización.
// El panel lo usa al cargar para decidir si muestra el aviso de
// «base de datos sin inicializar» o el formulario de login.

const auth = require('../../auth');
const db = require('../../db');
const { sendJson } = require('../../http');

module.exports = async function handler(req, res) {
  const admin = auth.getAdminFromRequest(req);
  let initialized = { schema: false, adminSeeded: false };
  let dbConfigured = db.isDbConfigured();
  if (dbConfigured) {
    try {
      initialized = await db.isInitialized();
    } catch {
      initialized = { schema: false, adminSeeded: false };
    }
  }
  return sendJson(res, 200, {
    ok: true,
    authenticated: Boolean(admin),
    username: admin ? admin.username : null,
    dbConfigured,
    initialized: initialized.schema && initialized.adminSeeded,
    initialization: initialized,
  });
};
