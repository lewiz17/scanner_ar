'use strict';

// Única función serverless del área admin (límite de 12 funciones del plan
// Hobby de Vercel): enruta por path hacia los handlers de lib/handlers/admin.
// Las rutas públicas no cambian: /api/admin/cards/:id/recharge, etc.

const { sendError } = require('../../lib/http');
const setup = require('../../lib/handlers/admin/setup');
const login = require('../../lib/handlers/admin/login');
const logout = require('../../lib/handlers/admin/logout');
const me = require('../../lib/handlers/admin/me');
const cards = require('../../lib/handlers/admin/cards');
const card = require('../../lib/handlers/admin/card');
const recharge = require('../../lib/handlers/admin/recharge');
const settings = require('../../lib/handlers/admin/settings');
const uploadUrl = require('../../lib/handlers/admin/upload-url');
const assetUrl = require('../../lib/handlers/admin/asset-url');

function segments(req) {
  try {
    const { pathname } = new URL(req.url, 'http://internal');
    const rest = pathname.replace(/^\/api\/admin\/?/, '').replace(/\/+$/, '');
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
        case 'setup': return await setup(req, res);
        case 'login': return await login(req, res);
        case 'logout': return await logout(req, res);
        case 'me': return await me(req, res);
        case 'cards': return await cards(req, res);
        case 'settings': return await settings(req, res);
        case 'upload-url': return await uploadUrl(req, res);
        case 'asset-url': return await assetUrl(req, res);
      }
    }
    if (seg.length === 2 && seg[0] === 'cards') {
      req.query = { ...(req.query || {}), id: seg[1] };
      return await card(req, res);
    }
    if (seg.length === 3 && seg[0] === 'cards' && seg[2] === 'recharge') {
      req.query = { ...(req.query || {}), id: seg[1] };
      return await recharge(req, res);
    }
    return sendError(res, 404, 'not_found');
  } catch (err) {
    console.error('admin router error', err);
    if (!res.writableEnded) return sendError(res, 500, 'internal_error');
  }
};
