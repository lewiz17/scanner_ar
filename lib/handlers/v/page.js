'use strict';

// GET /v/<slug> (rewrite → /api/v/page?slug=...)
// Renderiza la pantalla que corresponda según el estado de la tarjeta:
// activa → experiencia AR; agotada/expirada → bloqueo con WhatsApp (§4.4);
// borrador/pausada/archivada → aviso; inexistente → 404 amable.

const db = require('../../db');
const r2 = require('../../r2');
const { effectiveStatus } = require('../../cards');
const {
  renderExperiencePage,
  renderBlockedPage,
  renderInfoPage,
} = require('../../experience-template');

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
}

module.exports = async function handler(req, res) {
  const slug = req.query && req.query.slug;
  const fallbackBrand = 'Tarjetas Mágicas';
  if (!slug) {
    return sendHtml(res, 404, renderInfoPage({
      brand: fallbackBrand,
      heading: 'Tarjeta no encontrada',
      message: 'Este enlace no corresponde a ninguna tarjeta. Revisa el código QR e inténtalo de nuevo.',
    }));
  }
  let settings;
  let card = null;
  try {
    const store = db.createNeonStore();
    card = await store.getCardBySlug(slug);
    settings = await db.getSettings();
  } catch {
    return sendHtml(res, 503, renderInfoPage({
      brand: fallbackBrand,
      heading: 'Un momento…',
      message: 'Estamos teniendo un problema técnico. Inténtalo de nuevo en unos minutos.',
    }));
  }
  const brand = settings.business_name || fallbackBrand;
  if (!card) {
    return sendHtml(res, 404, renderInfoPage({
      brand,
      heading: 'Tarjeta no encontrada',
      message: 'Este enlace no corresponde a ninguna tarjeta. Revisa el código QR e inténtalo de nuevo.',
    }));
  }

  const status = effectiveStatus(card);
  if (status === 'agotada' || status === 'expirada') {
    return sendHtml(res, 200, renderBlockedPage(card, settings, { expired: status === 'expirada' }));
  }
  if (status !== 'activa') {
    return sendHtml(res, 200, renderInfoPage({
      brand,
      heading: 'Experiencia no disponible',
      message:
        status === 'pausada'
          ? 'Esta experiencia está pausada temporalmente. Vuelve a intentarlo más tarde.'
          : 'Esta experiencia todavía no está activa. Si eres el anfitrión, contacta a quien te entregó la tarjeta.',
    }));
  }

  // Activa: el póster se firma aquí (15 min) para pintar la bienvenida al
  // instante; marcador y video siempre pasan por /api/v/asset (§6.3).
  let posterUrl = '';
  if (card.poster_key && r2.isR2Configured()) {
    try {
      posterUrl = await r2.presignGet(card.poster_key, 900);
    } catch {
      posterUrl = '';
    }
  }
  return sendHtml(res, 200, renderExperiencePage(card, settings, { posterUrl }));
};
