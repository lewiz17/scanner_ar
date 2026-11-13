'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  signToken,
  verifyToken,
  createExperienceSession,
  verifyExperienceSession,
  hashDeviceId,
  isBotUserAgent,
  deviceClassFromUA,
} = require('../lib/session');

const SECRET = 'secreto-de-prueba';

test('token: firmar y verificar devuelve el payload', () => {
  const token = signToken({ typ: 'exp', cardId: 'c1', slug: 'boda-x7k2', sid: 's1' }, SECRET, 600);
  const payload = verifyToken(token, SECRET);
  assert.equal(payload.cardId, 'c1');
  assert.equal(payload.slug, 'boda-x7k2');
  assert.equal(payload.sid, 's1');
  assert.ok(payload.exp > payload.iat);
});

test('token: manipulado es rechazado', () => {
  const token = signToken({ typ: 'exp', cardId: 'c1' }, SECRET, 600);
  const [body, sig] = token.split('.');
  // Cambia un carácter de la firma.
  const badSig = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
  assert.equal(verifyToken(`${body}.${badSig}`, SECRET), null);
  // Cambia el payload reaprovechando la firma.
  const otherBody = signToken({ typ: 'exp', cardId: 'otra' }, SECRET, 600).split('.')[0];
  assert.equal(verifyToken(`${otherBody}.${sig}`, SECRET), null);
  // Secreto distinto.
  assert.equal(verifyToken(token, 'otro-secreto'), null);
  // Basura.
  assert.equal(verifyToken('no-es-un-token', SECRET), null);
  assert.equal(verifyToken('', SECRET), null);
  assert.equal(verifyToken(null, SECRET), null);
});

test('token: expirado es rechazado', () => {
  const token = signToken({ typ: 'exp', cardId: 'c1' }, SECRET, -10);
  assert.equal(verifyToken(token, SECRET), null);
  // Verificación con un "ahora" futuro también lo rechaza.
  const fresh = signToken({ typ: 'exp', cardId: 'c1' }, SECRET, 60);
  const future = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(verifyToken(fresh, SECRET, future), null);
});

test('sesión de experiencia: crear y verificar con sid', () => {
  const { token, sid } = createExperienceSession({ cardId: 'c9', slug: 'xv-maria-q3w8' }, SECRET);
  assert.ok(sid);
  const payload = verifyExperienceSession(token, SECRET);
  assert.equal(payload.cardId, 'c9');
  assert.equal(payload.sid, sid);
  // Un token de otro tipo no sirve como sesión de experiencia.
  const adminToken = signToken({ typ: 'admin', u: 'admin' }, SECRET, 600);
  assert.equal(verifyExperienceSession(adminToken, SECRET), null);
});

test('hashDeviceId: estable, distinto por dispositivo y no reversible a simple vista', () => {
  const a1 = hashDeviceId('device-1', SECRET);
  const a2 = hashDeviceId('device-1', SECRET);
  const b = hashDeviceId('device-2', SECRET);
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.match(a1, /^[0-9a-f]{64}$/);
  assert.equal(hashDeviceId('', SECRET), null);
});

test('isBotUserAgent y deviceClassFromUA', () => {
  assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBotUserAgent('facebookexternalhit/1.1'), true);
  assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), false);
  assert.equal(deviceClassFromUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios');
  assert.equal(deviceClassFromUA('Mozilla/5.0 (Linux; Android 14)'), 'android');
  assert.equal(deviceClassFromUA('Mozilla/5.0 (Windows NT 10.0)'), 'otro');
});
