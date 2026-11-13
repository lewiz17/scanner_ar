'use strict';

// Lógica de negocio de tarjetas y cupo (spec §6), escrita contra una
// interfaz de store para poder probarla sin base de datos.
//
// Interfaz de store que consumen estas funciones:
//   getCardBySlug(slug)            -> card | null
//   getCardById(id)                -> card | null
//   tryConsumeView({cardId, sessionId, mode, deviceClass, deviceHash,
//                   dedupeMinutes, now})
//     -> { outcome: 'counted'|'session'|'device'|'exhausted'|'not-active',
//          viewsUsed, quotaTotal }
//   La implementación real (Neon) hace el consumo con UNA sentencia SQL
//   condicional y atómica; el store en memoria de los tests replica la
//   misma semántica de forma síncrona.
//
// card: { id, slug, title, status, quota_total, views_used,
//         expires_at (Date|string|null), ... }

const crypto = require('node:crypto');

const CARD_STATUSES = ['borrador', 'activa', 'pausada', 'archivada'];

function remainingOf(card) {
  return Math.max(0, (card.quota_total || 0) - (card.views_used || 0));
}

// El estado "agotada" y "expirada" se derivan, no se guardan (§5.3):
// una tarjeta activa sin saldo está agotada; una activa vencida, expirada.
function effectiveStatus(card, now = new Date()) {
  if (!card) return 'inexistente';
  if (card.status !== 'activa') return card.status;
  if (card.expires_at && new Date(card.expires_at).getTime() <= now.getTime()) {
    return 'expirada';
  }
  if (remainingOf(card) <= 0) return 'agotada';
  return 'activa';
}

// ¿Se puede abrir una sesión de experiencia para esta tarjeta?
function checkSessionAllowed(card, now = new Date()) {
  const status = effectiveStatus(card, now);
  if (status === 'activa') return { ok: true, status };
  return { ok: false, status, reason: status };
}

// Registra una vista según §6.1/§6.2 delegando el consumo atómico al store.
async function registerView(store, { card, sessionId, mode, deviceClass, deviceHash, dedupeMinutes, now = new Date() }) {
  const status = effectiveStatus(card, now);
  if (status !== 'activa') {
    return { ok: false, counted: false, reason: status, remaining: remainingOf(card) };
  }
  const result = await store.tryConsumeView({
    cardId: card.id,
    sessionId,
    mode: mode === '2d' ? '2d' : 'ar',
    deviceClass: deviceClass || 'otro',
    deviceHash: deviceHash || null,
    dedupeMinutes: Math.max(0, dedupeMinutes ?? 10),
    now,
  });
  const remaining = Math.max(0, (result.quotaTotal ?? card.quota_total) - (result.viewsUsed ?? card.views_used));
  switch (result.outcome) {
    case 'counted':
      return { ok: true, counted: true, remaining };
    case 'session':
      return { ok: false, counted: false, reason: 'session-already-counted', remaining };
    case 'device':
      return { ok: false, counted: false, reason: 'device-dedupe', remaining };
    case 'exhausted':
      return { ok: false, counted: false, reason: 'exhausted', remaining: 0 };
    case 'not-active':
      return { ok: false, counted: false, reason: 'not-active', remaining };
    default:
      return { ok: false, counted: false, reason: 'unknown', remaining };
  }
}

// ---------- Slugs públicos no adivinables ----------

const SLUG_SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // sin caracteres ambiguos

function slugifyBase(title) {
  const base = String(title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || 'tarjeta';
}

function randomSuffix(length = 4) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SLUG_SUFFIX_ALPHABET[bytes[i] % SLUG_SUFFIX_ALPHABET.length];
  }
  return out;
}

// Ej.: generateSlug('Boda Ana & Luis') -> 'boda-ana-luis-x7k2'
function generateSlug(title, suffix = randomSuffix(4)) {
  return `${slugifyBase(title)}-${suffix}`;
}

module.exports = {
  CARD_STATUSES,
  remainingOf,
  effectiveStatus,
  checkSessionAllowed,
  registerView,
  generateSlug,
  slugifyBase,
};
