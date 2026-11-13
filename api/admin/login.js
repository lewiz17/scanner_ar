'use strict';

// POST /api/admin/login { username, password } → cookie de sesión admin.

const auth = require('../../lib/auth');
const db = require('../../lib/db');
const { sendJson, sendError, readJsonBody, clientIp, methodNotAllowed } = require('../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!db.isDbConfigured()) {
    return sendError(res, 503, 'database_not_configured');
  }
  const ip = clientIp(req);
  if (auth.loginRateLimited(ip)) {
    return sendError(res, 429, 'too_many_attempts', {
      message: 'Demasiados intentos. Espera 15 minutos.',
    });
  }
  const body = await readJsonBody(req);
  try {
    const admin = await auth.verifyCredentials(body.username, body.password);
    if (!admin) {
      auth.recordLoginAttempt(ip);
      return sendError(res, 401, 'invalid_credentials');
    }
    auth.clearLoginAttempts(ip);
    auth.setAdminCookie(res, admin.username);
    return sendJson(res, 200, { ok: true, username: admin.username });
  } catch (err) {
    // Lo más probable: la BD aún no está inicializada (no existe la tabla).
    return sendError(res, 503, 'db_not_initialized', {
      message: 'La base de datos aún no está inicializada.',
    });
  }
};
