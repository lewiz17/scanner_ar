'use strict';

// Plantillas HTML de la experiencia pública (/v/<slug>).
// - renderExperiencePage: tarjeta activa (bienvenida + AR + respaldo 2D)
// - renderBlockedPage:    tarjeta agotada/expirada (botón de WhatsApp, §4.4)
// - renderInfoPage:       no encontrada / no disponible

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      background: #101014; color: #f5f2ea; min-height: 100dvh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 24px;
    }
    .brand { font-size: .85rem; letter-spacing: .18em; text-transform: uppercase; opacity: .65; margin-bottom: 14px; }
    h1 { font-size: 1.7rem; line-height: 1.2; margin-bottom: 10px; }
    p { opacity: .85; max-width: 34ch; line-height: 1.5; }
    .btn {
      display: inline-block; margin-top: 26px; padding: 16px 30px; border: none; border-radius: 999px;
      background: #e8b64c; color: #191408; font-size: 1.1rem; font-weight: 700; cursor: pointer;
      text-decoration: none; box-shadow: 0 8px 24px rgba(232,182,76,.35);
    }
    .btn:active { transform: scale(.98); }
    .btn.whatsapp { background: #25d366; color: #062b16; box-shadow: 0 8px 24px rgba(37,211,102,.35); }
    .poster { width: min(72vw, 300px); border-radius: 16px; margin-bottom: 20px; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
    .small { margin-top: 18px; font-size: .85rem; opacity: .6; }
  `;
}

function pageShell({ title, brand, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${escapeHtml(title)} — ${escapeHtml(brand)}</title>
<style>${baseStyles()}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function renderInfoPage({ brand, heading, message }) {
  return pageShell({
    title: heading,
    brand,
    bodyHtml: `
      <div class="brand">${escapeHtml(brand)}</div>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(message)}</p>`,
  });
}

function packsSummary(settings) {
  const packs = [];
  for (let i = 1; i <= 3; i++) {
    const views = settings[`pack_${i}_views`];
    const price = settings[`pack_${i}_price`];
    if (!views) continue;
    packs.push(price > 0 ? `${views} vistas — $${price}` : `${views} vistas`);
  }
  return packs.join(' · ');
}

function buildWhatsAppUrl(card, settings) {
  const number = String(settings.whatsapp_number || '').replace(/\D/g, '');
  if (!number) return null;
  const template =
    settings.whatsapp_message ||
    'Hola, soy el anfitrión de {tarjeta} ({codigo}) y quiero recargar vistas. Paquetes: {paquetes}';
  const message = template
    .replaceAll('{tarjeta}', card.title)
    .replaceAll('{codigo}', card.slug)
    .replaceAll('{paquetes}', packsSummary(settings));
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function renderBlockedPage(card, settings, { expired = false } = {}) {
  const brand = settings.business_name || 'Tarjetas Mágicas';
  const waUrl = buildWhatsAppUrl(card, settings);
  const heading = expired
    ? 'Esta experiencia ya finalizó'
    : settings.blocked_text || 'Esta tarjeta ya alcanzó su límite de visualizaciones 💛';
  return pageShell({
    title: card.title,
    brand,
    bodyHtml: `
      <div class="brand">${escapeHtml(brand)}</div>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(card.title)} — si eres el anfitrión y quieres que tus invitados sigan viviendo este momento, recarga las vistas en un minuto.</p>
      ${waUrl ? `<a class="btn whatsapp" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener">Recargar vistas por WhatsApp</a>` : ''}
      <p class="small">El código de tu tarjeta es <strong>${escapeHtml(card.slug)}</strong></p>`,
  });
}

// ------------------- Página de la experiencia (AR) -------------------

function renderExperiencePage(card, settings, { posterUrl } = {}) {
  const brand = settings.business_name || 'Tarjetas Mágicas';
  const cardConfig = {
    slug: card.slug,
    title: card.title,
    eventType: card.event_type || '',
    imageW: card.image_w || 1000,
    imageH: card.image_h || 1000,
    posterUrl: posterUrl || '',
    businessName: brand,
  };
  const planeHeight = (cardConfig.imageH / cardConfig.imageW).toFixed(4);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>${escapeHtml(card.title)} — ${escapeHtml(brand)}</title>
<style>
${baseStyles()}
  #welcome { display: flex; flex-direction: column; align-items: center; }
  .hint { display:flex; align-items:center; gap:8px; margin-top:14px; font-size:.95rem; opacity:.85; }
  #ar-root { position: fixed; inset: 0; display: none; }
  #ar-root.on { display: block; }
  #ar-root video { object-fit: cover; }
  .a-enter-vr, .a-enter-ar { display: none !important; }
  #guide {
    position: fixed; left: 50%; bottom: 108px; transform: translateX(-50%);
    background: rgba(10,10,14,.72); color: #fff; padding: 10px 18px; border-radius: 999px;
    font-size: .95rem; display: none; z-index: 30; backdrop-filter: blur(4px); white-space: nowrap;
  }
  #guide.on { display: block; }
  #controls {
    position: fixed; left: 0; right: 0; bottom: 22px; display: none; z-index: 31;
    justify-content: center; gap: 12px;
  }
  #controls.on { display: flex; }
  .ctl {
    width: 54px; height: 54px; border-radius: 50%; border: none; cursor: pointer;
    background: rgba(255,255,255,.92); color: #191408; font-size: 1.35rem;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(0,0,0,.35);
  }
  #fallback2d { position: fixed; inset: 0; display: none; background: #000; z-index: 40; }
  #fallback2d.on { display: block; }
  #fallback2d video { width: 100%; height: 100%; object-fit: contain; }
  .linklike { background: none; border: none; color: #e8b64c; text-decoration: underline; cursor: pointer; font-size: .95rem; margin-top: 16px; }
  #status { margin-top: 14px; font-size: .9rem; opacity: .75; min-height: 1.2em; }
</style>
<script src="/vendor/aframe.min.js" defer></script>
<script src="/vendor/mindar-image-aframe.prod.js" defer></script>
</head>
<body>

<div id="welcome">
  <div class="brand">${escapeHtml(brand)}</div>
  ${posterUrl ? `<img class="poster" src="${escapeHtml(posterUrl)}" alt="">` : ''}
  <h1>${escapeHtml(card.title)}</h1>
  <p>Apunta la cámara al frente de tu tarjeta y mira cómo cobra vida.</p>
  <button class="btn" id="startBtn">📷 Activar cámara</button>
  <div id="status"></div>
  <button class="linklike" id="watch2dBtn">¿Sin cámara? Ver el video directamente</button>
</div>

<div id="ar-root"></div>
<div id="guide">🔍 Busca el frente de la tarjeta</div>
<div id="controls">
  <button class="ctl" id="soundBtn" title="Sonido">🔇</button>
  <button class="ctl" id="restartBtn" title="Reiniciar video">↺</button>
</div>

<div id="fallback2d"></div>

<script>
window.__CARD__ = ${JSON.stringify(cardConfig)};
(function () {
  var CARD = window.__CARD__;
  var token = null;
  var counted = false;
  var arVideo = null;
  var lastVideoSrcAt = 0;
  var foundTimer = null;
  var targetVisible = false;

  function $(id) { return document.getElementById(id); }
  function setStatus(msg) { $('status').textContent = msg || ''; }

  function deviceId() {
    try {
      var id = localStorage.getItem('tm_device_id');
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
        localStorage.setItem('tm_device_id', id);
      }
      return id;
    } catch (e) { return 'anon'; }
  }

  function assetUrl(kind) {
    return '/api/v/asset?slug=' + encodeURIComponent(CARD.slug) +
      '&kind=' + kind + '&token=' + encodeURIComponent(token || '');
  }

  function countView(mode) {
    if (counted || !token) return;
    counted = true;
    fetch('/api/v/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: CARD.slug, token: token, mode: mode, deviceId: deviceId() }),
      keepalive: true,
    }).catch(function () { /* §6.3: el conteo nunca bloquea la experiencia */ });
  }

  function getSession() {
    return fetch('/api/v/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: CARD.slug }),
    }).then(function (r) {
      if (!r.ok) throw new Error('session_' + r.status);
      return r.json();
    }).then(function (data) {
      token = data.token;
      return token;
    });
  }

  // ------------- Respaldo 2D (§4.3 paso 6) -------------
  function start2D() {
    $('welcome').style.display = 'none';
    $('guide').classList.remove('on');
    $('controls').classList.remove('on');
    var box = $('fallback2d');
    box.classList.add('on');
    if (!box.querySelector('video')) {
      var v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('controls', '');
      v.setAttribute('autoplay', '');
      v.crossOrigin = 'anonymous';
      v.src = assetUrl('video');
      v.addEventListener('playing', function () { countView('2d'); });
      box.appendChild(v);
      var p = v.play();
      if (p) p.catch(function () { /* el invitado puede tocar play */ });
    }
  }

  // ------------- Modo AR -------------
  function buildScene() {
    var root = $('ar-root');
    var planeH = ${planeHeight};
    root.innerHTML =
      '<a-scene mindar-image="imageTargetSrc: ' + assetUrl('marker') + '; autoStart: false; uiScanning: none; uiLoading: none;" ' +
      'embedded vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false" ' +
      'color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights">' +
      '<a-assets><video id="arvideo" preload="auto" loop playsinline webkit-playsinline crossorigin="anonymous"></video></a-assets>' +
      '<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
      '<a-entity id="target" mindar-image-target="targetIndex: 0">' +
      '<a-plane id="vplane" visible="false" position="0 0 0.01" width="1" height="' + planeH + '" material="shader: flat; src: #arvideo"></a-plane>' +
      '</a-entity></a-scene>';

    arVideo = root.querySelector('#arvideo');
    arVideo.addEventListener('playing', function () { countView('ar'); });
    var plane = root.querySelector('#vplane');
    var target = root.querySelector('#target');

    target.addEventListener('targetFound', function () {
      targetVisible = true;
      $('guide').classList.remove('on');
      plane.setAttribute('visible', true);
      foundTimer = setTimeout(function () {
        if (targetVisible) playArVideo();
      }, 800); // §6.1: detección sostenida ≥ 800 ms
    });
    target.addEventListener('targetLost', function () {
      targetVisible = false;
      if (foundTimer) clearTimeout(foundTimer);
      if (arVideo) arVideo.pause();
      plane.setAttribute('visible', false);
      $('guide').classList.add('on');
    });

    var scene = root.querySelector('a-scene');
    return scene;
  }

  function refreshVideoSrcIfStale() {
    var now = Date.now();
    if (!arVideo.getAttribute('src') || now - lastVideoSrcAt > 45000) {
      arVideo.src = assetUrl('video');
      lastVideoSrcAt = now;
    }
  }

  function playArVideo() {
    refreshVideoSrcIfStale();
    arVideo.muted = false;
    var p = arVideo.play();
    if (p) {
      p.then(function () { updateSoundBtn(); }).catch(function () {
        // El navegador exige empezar silenciado: mostrar botón de sonido.
        arVideo.muted = true;
        var p2 = arVideo.play();
        if (p2) p2.catch(function () {});
        updateSoundBtn();
      });
    }
    $('controls').classList.add('on');
  }

  function updateSoundBtn() {
    $('soundBtn').textContent = arVideo && !arVideo.muted ? '🔊' : '🔇';
  }

  function startAR() {
    if (typeof AFRAME === 'undefined' || typeof MINDAR === 'undefined') {
      start2D();
      return;
    }
    $('welcome').style.display = 'none';
    $('ar-root').classList.add('on');
    $('guide').classList.add('on');
    var scene = buildScene();
    var started = false;
    var startOnce = function () {
      if (started) return;
      started = true;
      try {
        var system = scene.systems['mindar-image-system'];
        var promise = system.start();
        if (promise && promise.catch) {
          promise.catch(function () { start2D(); });
        }
      } catch (e) {
        start2D();
      }
    };
    if (scene.hasLoaded) startOnce();
    else scene.addEventListener('loaded', startOnce);
    // Red de seguridad: si en 12 s no hay cámara, ofrecer 2D sin fricción.
    setTimeout(function () {
      if (!targetVisible && !counted && $('ar-root').classList.contains('on')) {
        $('guide').textContent = '¿Tarda mucho? Toca aquí para ver el video';
        $('guide').onclick = start2D;
      }
    }, 12000);
  }

  $('startBtn').addEventListener('click', function () {
    setStatus('Preparando tu experiencia…');
    getSession()
      .then(function () { setStatus(''); startAR(); })
      .catch(function () {
        // Cupo agotado o tarjeta no disponible: recargar para ver la
        // pantalla que corresponda (bloqueo / información).
        location.reload();
      });
  });

  $('watch2dBtn').addEventListener('click', function () {
    getSession()
      .then(function () { start2D(); })
      .catch(function () { location.reload(); });
  });

  $('soundBtn').addEventListener('click', function () {
    if (!arVideo) return;
    arVideo.muted = !arVideo.muted;
    if (!arVideo.muted) { var p = arVideo.play(); if (p) p.catch(function () {}); }
    updateSoundBtn();
  });

  $('restartBtn').addEventListener('click', function () {
    if (!arVideo) return;
    arVideo.currentTime = 0;
    var p = arVideo.play();
    if (p) p.catch(function () {});
  });
})();
</script>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  renderExperiencePage,
  renderBlockedPage,
  renderInfoPage,
  buildWhatsAppUrl,
  packsSummary,
};
