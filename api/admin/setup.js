'use strict';

// POST /api/admin/setup — inicializa la base de datos (esquema + siembra).
// Protegido por el header x-setup-secret === SETUP_SECRET (env).
// Es el primer paso tras desplegar: lo llama el botón «Inicializar base
// de datos» del panel.

const db = require('../../lib/db');
const { sendJson, sendError, methodNotAllowed } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const expected = process.env.SETUP_SECRET;
  if (!expected) {
    return sendError(res, 500, 'setup_secret_not_configured', {
      message: 'Falta la variable de entorno SETUP_SECRET en Vercel.',
    });
  }
  if (!db.isDbConfigured()) {
    return sendError(res, 500, 'database_not_configured', {
      message: 'Falta la variable de entorno DATABASE_URL en Vercel.',
    });
  }
  const provided = req.headers['x-setup-secret'];
  if (provided !== expected) {
    return sendError(res, 401, 'invalid_setup_secret');
  }
  try {
    const sql = db.getSql();
    await db.ensureSchema(sql);
    await db.seedIfEmpty(sql);
    const status = await db.isInitialized(sql);
    return sendJson(res, 200, { ok: true, initialized: status });
  } catch (err) {
    return sendError(res, 500, 'setup_failed', { message: String(err && err.message || err) });
  }
};
