'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkSessionAllowed,
  registerView,
  effectiveStatus,
  remainingOf,
} = require('../lib/cards');
const { MemoryStore } = require('./memory-store');

const T0 = new Date('2026-11-13T12:00:00Z');
const minutesLater = (mins) => new Date(T0.getTime() + mins * 60_000);

function makeCard(store, overrides = {}) {
  return store.addCard({
    id: 'card-1',
    slug: 'boda-ana-luis-x7k2',
    title: 'Boda Ana & Luis',
    status: 'activa',
    quota_total: 3,
    views_used: 0,
    expires_at: null,
    ...overrides,
  });
}

function viewArgs(card, overrides = {}) {
  return {
    card,
    sessionId: 'session-1',
    mode: 'ar',
    deviceClass: 'android',
    deviceHash: 'hash-device-1',
    dedupeMinutes: 10,
    now: T0,
    ...overrides,
  };
}

test('sesión: solo se permite con tarjeta activa y con cupo', () => {
  const store = new MemoryStore();
  const ok = makeCard(store);
  assert.deepEqual(checkSessionAllowed(ok, T0), { ok: true, status: 'activa' });

  const borrador = makeCard(store, { id: 'c2', slug: 'x-2', status: 'borrador' });
  assert.equal(checkSessionAllowed(borrador, T0).ok, false);
  assert.equal(checkSessionAllowed(borrador, T0).reason, 'borrador');

  const sinCupo = makeCard(store, { id: 'c3', slug: 'x-3', quota_total: 2, views_used: 2 });
  assert.equal(effectiveStatus(sinCupo, T0), 'agotada');
  assert.equal(checkSessionAllowed(sinCupo, T0).reason, 'agotada');

  const expirada = makeCard(store, {
    id: 'c4', slug: 'x-4', expires_at: new Date('2026-01-01T00:00:00Z'),
  });
  assert.equal(effectiveStatus(expirada, T0), 'expirada');
});

test('vista: se cuenta una vez y descuenta el cupo', async () => {
  const store = new MemoryStore();
  const card = makeCard(store);
  const r = await registerView(store, viewArgs(card));
  assert.equal(r.ok, true);
  assert.equal(r.counted, true);
  assert.equal(r.remaining, 2);
  assert.equal(card.views_used, 1);
  assert.equal(store.viewEvents.length, 1);
  assert.equal(store.viewEvents[0].mode, 'ar');
});

test('vista: la misma sesión no puede contar dos veces', async () => {
  const store = new MemoryStore();
  const card = makeCard(store);
  const first = await registerView(store, viewArgs(card));
  assert.equal(first.counted, true);
  // Misma sesión, otro dispositivo y fuera de la ventana de dedupe:
  // aun así no cuenta (una sesión = máximo una vista, §6.2).
  const second = await registerView(store, viewArgs(card, {
    deviceHash: 'hash-otro',
    now: minutesLater(60),
  }));
  assert.equal(second.counted, false);
  assert.equal(second.reason, 'session-already-counted');
  assert.equal(card.views_used, 1);
  assert.equal(store.viewEvents.length, 1);
});

test('vista: dedupe por dispositivo bloquea dentro de la ventana y permite después', async () => {
  const store = new MemoryStore();
  const card = makeCard(store, { quota_total: 10 });
  const first = await registerView(store, viewArgs(card, { sessionId: 's1' }));
  assert.equal(first.counted, true);

  const withinWindow = await registerView(store, viewArgs(card, {
    sessionId: 's2',
    now: minutesLater(5),
  }));
  assert.equal(withinWindow.counted, false);
  assert.equal(withinWindow.reason, 'device-dedupe');
  assert.equal(card.views_used, 1);

  // Otro dispositivo dentro de la ventana sí cuenta.
  const otherDevice = await registerView(store, viewArgs(card, {
    sessionId: 's3',
    deviceHash: 'hash-device-2',
    now: minutesLater(6),
  }));
  assert.equal(otherDevice.counted, true);

  // El mismo dispositivo después de la ventana (10 min) vuelve a contar.
  const afterWindow = await registerView(store, viewArgs(card, {
    sessionId: 's4',
    now: minutesLater(11),
  }));
  assert.equal(afterWindow.counted, true);
  assert.equal(card.views_used, 3);
});

test('vista: tarjeta agotada no cuenta y el saldo nunca baja de cero', async () => {
  const store = new MemoryStore();
  const card = makeCard(store, { quota_total: 1 });

  const first = await registerView(store, viewArgs(card, { sessionId: 's1' }));
  assert.equal(first.counted, true);
  assert.equal(first.remaining, 0);

  // Dos intentos "simultáneos" por la última vista: ninguno más pasa.
  const [a, b] = await Promise.all([
    registerView(store, viewArgs(card, { sessionId: 's2', deviceHash: 'h2', now: minutesLater(30) })),
    registerView(store, viewArgs(card, { sessionId: 's3', deviceHash: 'h3', now: minutesLater(30) })),
  ]);
  assert.equal(a.counted, false);
  assert.equal(b.counted, false);
  assert.equal(card.views_used, 1);
  assert.equal(remainingOf(card), 0);
  assert.equal(effectiveStatus(card, T0), 'agotada');
});

test('vista: con cupo 1 solo una de dos sesiones simultáneas cuenta', async () => {
  const store = new MemoryStore();
  const card = makeCard(store, { quota_total: 1 });
  const results = await Promise.all([
    registerView(store, viewArgs(card, { sessionId: 'sa', deviceHash: 'ha' })),
    registerView(store, viewArgs(card, { sessionId: 'sb', deviceHash: 'hb' })),
  ]);
  assert.equal(results.filter((r) => r.counted).length, 1);
  assert.equal(card.views_used, 1);
});

test('vista: tarjeta pausada no cuenta', async () => {
  const store = new MemoryStore();
  const card = makeCard(store, { status: 'pausada' });
  const r = await registerView(store, viewArgs(card));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pausada');
  assert.equal(card.views_used, 0);
});

test('vista: modo 2d también cuenta y queda registrado', async () => {
  const store = new MemoryStore();
  const card = makeCard(store);
  const r = await registerView(store, viewArgs(card, { mode: '2d' }));
  assert.equal(r.counted, true);
  assert.equal(store.viewEvents[0].mode, '2d');
});
