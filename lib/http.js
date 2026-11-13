'use strict';

// Utilidades HTTP compartidas por las funciones de Vercel (req, res).

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function sendError(res, status, error, extra = {}) {
  sendJson(res, status, { ok: false, error, ...extra });
}

// Vercel ya parsea JSON en req.body; esto cubre el caso de que llegue texto.
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body || '{}');
      } catch {
        return {};
      }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function parseCookies(req) {
  const header = (req.headers && (req.headers.cookie || req.headers.Cookie)) || '';
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

function clientIp(req) {
  const fwd = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// URL base pública de la app (para construir enlaces/QR).
function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  }
  const host = req.headers && (req.headers['x-forwarded-host'] || req.headers.host);
  const proto =
    (req.headers && req.headers['x-forwarded-proto']) ||
    (host && host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  sendError(res, 405, 'method_not_allowed');
}

module.exports = {
  sendJson,
  sendError,
  readJsonBody,
  parseCookies,
  clientIp,
  publicBaseUrl,
  methodNotAllowed,
};
