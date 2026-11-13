'use strict';

// Acceso a datos: Neon (Postgres serverless) vía driver HTTP.
// Incluye el DDL (ensureSchema), la siembra inicial (seed) y la
// implementación del store que consume lib/cards.js.

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { generateSlug } = require('./cards');

let _sql = null;
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta la variable de entorno DATABASE_URL');
    _sql = neon(url);
  }
  return _sql;
}

function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// ---------------- Esquema (§8.4 + view_dedupe de §6.2) ----------------

const DDL = [
  `CREATE TABLE IF NOT EXISTS admin_users (
     id SERIAL PRIMARY KEY,
     username TEXT UNIQUE NOT NULL,
     password_hash TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL DEFAULT ''
   )`,
  `CREATE TABLE IF NOT EXISTS cards (
     id UUID PRIMARY KEY,
     slug TEXT UNIQUE NOT NULL,
     title TEXT NOT NULL,
     client_name TEXT NOT NULL DEFAULT '',
     event_type TEXT NOT NULL DEFAULT 'otro',
     event_date DATE,
     notes TEXT NOT NULL DEFAULT '',
     image_key TEXT NOT NULL DEFAULT '',
     marker_key TEXT NOT NULL DEFAULT '',
     video_key TEXT NOT NULL DEFAULT '',
     poster_key TEXT NOT NULL DEFAULT '',
     image_w INTEGER,
     image_h INTEGER,
     marker_quality TEXT NOT NULL DEFAULT '',
     video_mode TEXT NOT NULL DEFAULT 'normal',
     video_w INTEGER,
     video_h INTEGER,
     content_type TEXT NOT NULL DEFAULT 'video',
     layers JSONB NOT NULL DEFAULT '[]'::jsonb,
     model_key TEXT NOT NULL DEFAULT '',
     model_scale REAL NOT NULL DEFAULT 1,
     model_rotation_y INTEGER NOT NULL DEFAULT 0,
     model_upright BOOLEAN NOT NULL DEFAULT true,
     quota_total INTEGER NOT NULL DEFAULT 0,
     views_used INTEGER NOT NULL DEFAULT 0,
     status TEXT NOT NULL DEFAULT 'borrador',
     activated_at TIMESTAMPTZ,
     expires_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  // Migraciones para bases ya inicializadas (columnas posteriores al MVP).
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS video_mode TEXT NOT NULL DEFAULT 'normal'`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS video_w INTEGER`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS video_h INTEGER`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'video'`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS layers JSONB NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS model_key TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS model_scale REAL NOT NULL DEFAULT 1`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS model_rotation_y INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE cards ADD COLUMN IF NOT EXISTS model_upright BOOLEAN NOT NULL DEFAULT true`,
  `CREATE TABLE IF NOT EXISTS view_events (
     id BIGSERIAL PRIMARY KEY,
     card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
     session_id TEXT NOT NULL,
     mode TEXT NOT NULL DEFAULT 'ar',
     device_class TEXT NOT NULL DEFAULT 'otro',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS view_events_session_idx ON view_events (session_id)`,
  `CREATE INDEX IF NOT EXISTS view_events_card_created_idx ON view_events (card_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS view_dedupe (
     card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
     device_hash TEXT NOT NULL,
     last_view_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (card_id, device_hash)
   )`,
  `CREATE TABLE IF NOT EXISTS recharges (
     id BIGSERIAL PRIMARY KEY,
     card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
     pack_label TEXT NOT NULL DEFAULT '',
     views_added INTEGER NOT NULL,
     price_charged NUMERIC(12,2) NOT NULL DEFAULT 0,
     note TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS recharges_card_idx ON recharges (card_id, created_at)`,
];

async function ensureSchema(sql = getSql()) {
  for (const stmt of DDL) {
    await sql.query(stmt);
  }
}

// ---------------- Ajustes por defecto (§5.4) ----------------

const DEFAULT_SETTINGS = {
  business_name: 'Tarjetas Mágicas',
  whatsapp_number: '',
  pack_1_views: '50',
  pack_1_price: '0',
  pack_2_views: '100',
  pack_2_price: '0',
  pack_3_views: '200',
  pack_3_price: '0',
  default_quota: '100',
  validity_months: '12',
  dedupe_minutes: '10',
  blocked_text: 'Esta tarjeta ya alcanzó su límite de visualizaciones 💛',
  whatsapp_message:
    'Hola, soy el anfitrión de {tarjeta} ({codigo}) y quiero recargar vistas para seguir compartiéndola. Paquetes disponibles: {paquetes}',
};

const NUMERIC_SETTING_KEYS = [
  'pack_1_views', 'pack_1_price', 'pack_2_views', 'pack_2_price',
  'pack_3_views', 'pack_3_price', 'default_quota', 'validity_months',
  'dedupe_minutes',
];

async function seedIfEmpty(sql = getSql()) {
  // Ajustes: solo inserta los que falten.
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await sql.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value],
    );
  }
  // Usuario admin inicial desde variables de entorno.
  const rows = await sql.query('SELECT COUNT(*)::int AS n FROM admin_users');
  if (rows[0].n === 0) {
    const username = process.env.ADMIN_USER || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      throw new Error(
        'Falta ADMIN_PASSWORD: defínela en las variables de entorno antes de inicializar.',
      );
    }
    const hash = await bcrypt.hash(password, 10);
    await sql.query(
      'INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)',
      [username, hash],
    );
  }
}

async function isInitialized(sql = getSql()) {
  try {
    const reg = await sql.query("SELECT to_regclass('public.cards') AS t");
    if (!reg[0].t) return { schema: false, adminSeeded: false };
    const users = await sql.query('SELECT COUNT(*)::int AS n FROM admin_users');
    return { schema: true, adminSeeded: users[0].n > 0 };
  } catch {
    return { schema: false, adminSeeded: false };
  }
}

// ---------------- Ajustes (lectura/escritura) ----------------

async function getSettings(sql = getSql()) {
  const rows = await sql.query('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const row of rows) out[row.key] = row.value;
  for (const key of NUMERIC_SETTING_KEYS) {
    const n = Number(out[key]);
    out[key] = Number.isFinite(n) ? n : Number(DEFAULT_SETTINGS[key]);
  }
  return out;
}

async function updateSettings(patch, sql = getSql()) {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  for (const [key, value] of Object.entries(patch || {})) {
    if (!allowed.includes(key)) continue;
    await sql.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, String(value ?? '')],
    );
  }
  return getSettings(sql);
}

// ---------------- Store para lib/cards.js ----------------

function createNeonStore(sql = getSql()) {
  return {
    async getCardBySlug(slug) {
      const rows = await sql.query('SELECT * FROM cards WHERE slug = $1', [slug]);
      return rows[0] || null;
    },
    async getCardById(id) {
      const rows = await sql.query('SELECT * FROM cards WHERE id = $1', [id]);
      return rows[0] || null;
    },
    // Consumo atómico (§6.3): una sola sentencia condicional.
    async tryConsumeView({ cardId, sessionId, mode, deviceClass, deviceHash, dedupeMinutes }) {
      const rows = await sql.query(
        `WITH upd AS (
           UPDATE cards SET views_used = views_used + 1, updated_at = now()
           WHERE id = $1 AND status = 'activa' AND quota_total - views_used > 0
             AND NOT EXISTS (SELECT 1 FROM view_events WHERE session_id = $2)
             AND ($3::text IS NULL OR NOT EXISTS (
               SELECT 1 FROM view_dedupe
               WHERE card_id = $1 AND device_hash = $3
                 AND last_view_at > now() - ($4 * interval '1 minute')
             ))
           RETURNING views_used, quota_total
         ),
         ins AS (
           INSERT INTO view_events (card_id, session_id, mode, device_class)
           SELECT $1, $2, $5, $6 FROM upd
         ),
         dd AS (
           INSERT INTO view_dedupe (card_id, device_hash, last_view_at)
           SELECT $1, $3, now() FROM upd WHERE $3::text IS NOT NULL
           ON CONFLICT (card_id, device_hash)
           DO UPDATE SET last_view_at = EXCLUDED.last_view_at
         )
         SELECT views_used, quota_total FROM upd`,
        [cardId, sessionId, deviceHash, dedupeMinutes, mode, deviceClass],
      );
      if (rows.length > 0) {
        return { outcome: 'counted', viewsUsed: rows[0].views_used, quotaTotal: rows[0].quota_total };
      }
      // No se consumió: averiguar el motivo con una lectura.
      const diag = await sql.query(
        `SELECT status, quota_total, views_used,
           EXISTS (SELECT 1 FROM view_events WHERE session_id = $2) AS session_seen,
           ($3::text IS NOT NULL AND EXISTS (
             SELECT 1 FROM view_dedupe
             WHERE card_id = $1 AND device_hash = $3
               AND last_view_at > now() - ($4 * interval '1 minute')
           )) AS device_recent
         FROM cards WHERE id = $1`,
        [cardId, sessionId, deviceHash, dedupeMinutes],
      );
      const card = diag[0];
      if (!card) return { outcome: 'not-active', viewsUsed: 0, quotaTotal: 0 };
      let outcome = 'exhausted';
      if (card.session_seen) outcome = 'session';
      else if (card.device_recent) outcome = 'device';
      else if (card.status !== 'activa') outcome = 'not-active';
      return { outcome, viewsUsed: card.views_used, quotaTotal: card.quota_total };
    },
  };
}

// ---------------- CRUD de tarjetas (panel) ----------------

async function listCardsWithStats(sql = getSql()) {
  return sql.query(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM view_events v
          WHERE v.card_id = c.id AND v.created_at::date = CURRENT_DATE) AS views_today,
       (SELECT MAX(v.created_at) FROM view_events v
          WHERE v.card_id = c.id) AS last_view_at
     FROM cards c
     ORDER BY c.created_at DESC`,
  );
}

// Capas del modo «multicapas»: [{ key, depth }] de atrás hacia adelante,
// depth 0..1 (0 = pegada a la tarjeta, 1 = la que más flota). Máx. 4.
function sanitizeLayers(input) {
  let arr = input;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((l) => l && typeof l.key === 'string' && l.key)
    .slice(0, 4)
    .map((l, i, all) => ({
      key: l.key,
      depth: Number.isFinite(+l.depth)
        ? Math.min(1, Math.max(0, +l.depth))
        : all.length > 1
          ? i / (all.length - 1)
          : 0.5,
      anim: l.anim === true,
      motion: ['float', 'spin', 'pulse'].includes(l.motion) ? l.motion : 'none',
    }));
}

function sanitizeContentType(value) {
  return ['video', 'layers', 'model3d'].includes(value) ? value : 'video';
}

async function createCard(data, sql = getSql()) {
  const id = data.id || crypto.randomUUID();
  const baseTitle = data.title || 'Sin título';
  let slug = data.slug || generateSlug(baseTitle);
  const fields = {
    title: baseTitle,
    client_name: data.client_name || '',
    event_type: data.event_type || 'otro',
    event_date: data.event_date || null,
    notes: data.notes || '',
    image_key: data.image_key || '',
    marker_key: data.marker_key || '',
    video_key: data.video_key || '',
    poster_key: data.poster_key || '',
    image_w: data.image_w ?? null,
    image_h: data.image_h ?? null,
    marker_quality: data.marker_quality || '',
    video_mode: data.video_mode === 'alpha' ? 'alpha' : 'normal',
    video_w: Number.isFinite(+data.video_w) && +data.video_w > 0 ? Math.floor(+data.video_w) : null,
    video_h: Number.isFinite(+data.video_h) && +data.video_h > 0 ? Math.floor(+data.video_h) : null,
    content_type: sanitizeContentType(data.content_type),
    layers: sanitizeLayers(data.layers),
    model_key: data.model_key || '',
    model_scale: Number.isFinite(+data.model_scale) ? Math.min(10, Math.max(0.1, +data.model_scale)) : 1,
    model_rotation_y: Number.isFinite(+data.model_rotation_y) ? Math.floor(+data.model_rotation_y) % 360 : 0,
    model_upright: data.model_upright !== false,
    quota_total: Number.isFinite(+data.quota_total) ? Math.max(0, Math.floor(+data.quota_total)) : 0,
    status: ['borrador', 'activa', 'pausada'].includes(data.status) ? data.status : 'borrador',
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const rows = await sql.query(
        `INSERT INTO cards (id, slug, title, client_name, event_type, event_date, notes,
           image_key, marker_key, video_key, poster_key, image_w, image_h, marker_quality,
           video_mode, video_w, video_h,
           content_type, layers, model_key, model_scale, model_rotation_y, model_upright,
           quota_total, status, activated_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
                 CASE WHEN $25 = 'activa' THEN now() ELSE NULL END,
                 CASE WHEN $25 = 'activa' THEN now() + ($26 * interval '1 month') ELSE NULL END)
         RETURNING *`,
        [
          id, slug, fields.title, fields.client_name, fields.event_type,
          fields.event_date, fields.notes, fields.image_key, fields.marker_key,
          fields.video_key, fields.poster_key, fields.image_w, fields.image_h,
          fields.marker_quality, fields.video_mode, fields.video_w, fields.video_h,
          fields.content_type, JSON.stringify(fields.layers), fields.model_key,
          fields.model_scale, fields.model_rotation_y, fields.model_upright,
          fields.quota_total, fields.status,
          Number(data.validity_months) || 12,
        ],
      );
      return rows[0];
    } catch (err) {
      // 23505 = unique_violation (slug repetido): reintentar con otro sufijo.
      if (err && err.code === '23505' && attempt < 5) {
        slug = generateSlug(baseTitle);
        continue;
      }
      throw err;
    }
  }
  throw new Error('No se pudo generar un slug único');
}

const CARD_EDITABLE_FIELDS = [
  'title', 'client_name', 'event_type', 'event_date', 'notes',
  'image_key', 'marker_key', 'video_key', 'poster_key',
  'image_w', 'image_h', 'marker_quality',
  'video_mode', 'video_w', 'video_h',
  'content_type', 'layers', 'model_key', 'model_scale', 'model_rotation_y', 'model_upright',
];

async function updateCard(id, patch, sql = getSql()) {
  const store = createNeonStore(sql);
  const card = await store.getCardById(id);
  if (!card) return null;
  if (patch.video_mode !== undefined) {
    patch = { ...patch, video_mode: patch.video_mode === 'alpha' ? 'alpha' : 'normal' };
  }
  if (patch.content_type !== undefined) {
    patch = { ...patch, content_type: sanitizeContentType(patch.content_type) };
  }
  if (patch.layers !== undefined) {
    patch = { ...patch, layers: JSON.stringify(sanitizeLayers(patch.layers)) };
  }
  if (patch.model_scale !== undefined) {
    const s = +patch.model_scale;
    patch = { ...patch, model_scale: Number.isFinite(s) ? Math.min(10, Math.max(0.1, s)) : 1 };
  }
  if (patch.model_rotation_y !== undefined) {
    const r = +patch.model_rotation_y;
    patch = { ...patch, model_rotation_y: Number.isFinite(r) ? Math.floor(r) % 360 : 0 };
  }
  const sets = [];
  const params = [];
  let i = 1;
  for (const field of CARD_EDITABLE_FIELDS) {
    if (patch[field] !== undefined) {
      sets.push(`${field} = $${i++}`);
      params.push(patch[field] === '' && field === 'event_date' ? null : patch[field]);
    }
  }
  if (patch.status !== undefined && ['borrador', 'activa', 'pausada', 'archivada'].includes(patch.status)) {
    sets.push(`status = $${i++}`);
    params.push(patch.status);
    if (patch.status === 'activa' && !card.activated_at) {
      const settings = await getSettings(sql);
      sets.push('activated_at = now()');
      sets.push(`expires_at = now() + ($${i++} * interval '1 month')`);
      params.push(settings.validity_months);
    }
  }
  if (sets.length === 0) return card;
  sets.push('updated_at = now()');
  params.push(id);
  const rows = await sql.query(
    `UPDATE cards SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  return rows[0] || null;
}

// Recarga o ajuste manual de cupo: queda registrado en `recharges` (§4.4/§5.6)
// y suma al cupo en la misma sentencia.
async function addRecharge(cardId, { packLabel, viewsAdded, priceCharged = 0, note = '' }, sql = getSql()) {
  const views = Math.floor(+viewsAdded);
  if (!Number.isFinite(views) || views === 0) {
    throw new Error('viewsAdded debe ser un número distinto de cero');
  }
  const rows = await sql.query(
    `WITH r AS (
       INSERT INTO recharges (card_id, pack_label, views_added, price_charged, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING id
     )
     UPDATE cards
     SET quota_total = GREATEST(views_used, quota_total + $3), updated_at = now()
     WHERE id = $1
     RETURNING quota_total, views_used`,
    [cardId, packLabel || '', views, Number(priceCharged) || 0, note || ''],
  );
  if (rows.length === 0) return null;
  return { quotaTotal: rows[0].quota_total, viewsUsed: rows[0].views_used };
}

async function listRecharges(cardId, sql = getSql()) {
  return sql.query(
    'SELECT * FROM recharges WHERE card_id = $1 ORDER BY created_at DESC LIMIT 100',
    [cardId],
  );
}

// ---------------- Admin ----------------

async function findAdminByUsername(username, sql = getSql()) {
  const rows = await sql.query(
    'SELECT * FROM admin_users WHERE username = $1',
    [username],
  );
  return rows[0] || null;
}

module.exports = {
  getSql,
  isDbConfigured,
  ensureSchema,
  seedIfEmpty,
  isInitialized,
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
  createNeonStore,
  listCardsWithStats,
  createCard,
  updateCard,
  addRecharge,
  listRecharges,
  findAdminByUsername,
};
