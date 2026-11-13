'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateSlug, slugifyBase } = require('../lib/cards');

test('slug: formato base-sufijo sin caracteres ambiguos', () => {
  for (let i = 0; i < 50; i++) {
    const slug = generateSlug('Boda Ana & Luis');
    assert.match(slug, /^boda-ana-luis-[a-z2-9]{6}$/);
    assert.ok(!/[lio01]/.test(slug.split('-').pop()), 'el sufijo no usa caracteres ambiguos');
  }
});

test('slug: únicos en la práctica', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(generateSlug('Cumpleaños'));
  assert.equal(seen.size, 500);
});

test('slug: quita acentos, espacios y símbolos', () => {
  assert.equal(slugifyBase('XV Años de María José'), 'xv-anos-de-maria-jose');
  assert.equal(slugifyBase('  ¡Baby Shower! — Niño/a  '), 'baby-shower-nino-a');
  assert.equal(slugifyBase(''), 'tarjeta');
  assert.equal(slugifyBase('🎉🎉🎉'), 'tarjeta');
});

test('slug: la base se corta a 40 caracteres', () => {
  const base = slugifyBase('a'.repeat(80));
  assert.equal(base.length, 40);
});
