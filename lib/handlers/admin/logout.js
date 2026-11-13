'use strict';

// POST /api/admin/logout → borra la cookie de sesión.

const auth = require('../../auth');
const { sendJson, methodNotAllowed } = require('../../http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  auth.clearAdminCookie(res);
  return sendJson(res, 200, { ok: true });
};
