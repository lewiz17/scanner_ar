'use strict';

// Única función serverless del área pública (límite de 12 funciones del plan
// Hobby de Vercel): enruta por path hacia los handlers de lib/handlers/v.
// Las rutas públicas no cambian: /api/v/page, /api/v/session, /api/v/view,
// /api/v/asset (y el rewrite /v/:slug → /api/v/page?slug=:slug sigue igual).

const { sendError } = require('../../lib/http');
const page = require('../../lib/handlers/v/page');
const session = require('../../lib/handlers/v/session');
const view = require('../../lib/handlers/v/view');
const asset = require('../../lib/handlers/v/asset');

function segments(req) {
  try {
    const { pathname } = new URL(req.url, 'http://internal');
    const rest = pathname.replace(/^\/api\/v\/?/, '').replace(/\/+$/, '');
    return rest ? rest.split('/').map(decodeURIComponent) : [];
  } catch {
    return [];
  }
}

module.exports = async function handler(req, res) {
  const seg = segments(req);
  try {
    if (seg.length === 1) {
      switch (seg[0]) {
        case 'page': return await page(req, res);
        case 'session': return await session(req, res);
        case 'view': return await view(req, res);
        case 'asset': return await asset(req, res);
      }
    }
    return sendError(res, 404, 'not_found');
  } catch (err) {
    console.error('public router error', err);
    if (!res.writableEnded) return sendError(res, 500, 'internal_error');
  }
};
