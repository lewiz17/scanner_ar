'use strict';

// Sesión del administrador: cookie httpOnly firmada (HMAC) + login con
// bcrypt y límite simple de intentos por IP (§5.1).

const bcrypt = require('bcryptjs');
const {
  getSessionSecret,
  signToken,
  verifyToken,
} = require('./session');
const { parseCookies, clientIp, sendError } = require('./http');
const db = require('./db');

const ADMIN_COOKIE = 'tm_admin';
const ADMIN_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

// ---- Límite de intentos de login (en memoria; en serverless es por
// instancia efímera, suficiente como fricción básica para el MVP). ----
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map(); // ip -> { count, resetAt }

function loginRateLimited(ip, nowMs = Date.now()) {
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= nowMs) return false;
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginAttempt(ip, nowMs = Date.now()) {
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= nowMs) {
    loginAttempts.set(ip, { count: 1, resetAt: nowMs + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
  // Limpieza oportunista para no crecer sin límite.
  if (loginAttempts.size > 500) {
    for (const [key, value] of loginAttempts) {
      if (value.resetAt <= nowMs) loginAttempts.delete(key);
    }
  }
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// ---- Credenciales ----

async function verifyCredentials(username, password) {
  if (!username || !password) return null;
  const admin = await db.findAdminByUsername(username);
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  return ok ? admin : null;
}

// ---- Cookie de sesión ----

function createAdminCookieValue(username) {
  return signToken({ typ: 'admin', u: username }, getSessionSecret(), ADMIN_SESSION_TTL_SECONDS);
}

function setAdminCookie(res, username) {
  const value = createAdminCookieValue(username);
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );
}

function getAdminFromRequest(req) {
  try {
    const cookies = parseCookies(req);
    const payload = verifyToken(cookies[ADMIN_COOKIE], getSessionSecret());
    if (!payload || payload.typ !== 'admin' || !payload.u) return null;
    return { username: payload.u };
  } catch {
    return null;
  }
}

// Middleware para funciones /api/admin/* (excepto login y setup).
// Si no hay sesión válida, responde 401 y devuelve null.
function requireAdmin(req, res) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    sendError(res, 401, 'unauthorized');
    return null;
  }
  return admin;
}

module.exports = {
  ADMIN_COOKIE,
  loginRateLimited,
  recordLoginAttempt,
  clearLoginAttempts,
  verifyCredentials,
  setAdminCookie,
  clearAdminCookie,
  getAdminFromRequest,
  requireAdmin,
  // exportado para tests
  _loginAttempts: loginAttempts,
};
