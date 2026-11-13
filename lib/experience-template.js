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

// La fila de Neon trae layers como arreglo (JSONB) o como texto: se
// normaliza a solo las profundidades (las claves R2 no salen del servidor;
// el endpoint de assets las resuelve por índice con la sesión del invitado).
function normalizeLayerDepths(input) {
  let arr = input;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 4).map((l) => {
    const d = Number(l && l.depth);
    return Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 0.5;
  });
}

function renderExperiencePage(card, settings, { posterUrl } = {}) {
  const brand = settings.business_name || 'Tarjetas Mágicas';
  const cardConfig = {
    slug: card.slug,
    title: card.title,
    eventType: card.event_type || '',
    imageW: card.image_w || 1000,
    imageH: card.image_h || 1000,
    videoMode: card.video_mode === 'alpha' ? 'alpha' : 'normal',
    videoW: card.video_w || 0,
    videoH: card.video_h || 0,
    contentType: ['layers', 'model3d'].includes(card.content_type) ? card.content_type : 'video',
    layers: normalizeLayerDepths(card.layers),
    modelScale: Number(card.model_scale) > 0 ? Number(card.model_scale) : 1,
    modelRotationY: Number(card.model_rotation_y) || 0,
    modelUpright: card.model_upright !== false,
    posterUrl: posterUrl || '',
    businessName: brand,
  };
  const planeHeight = (cardConfig.imageH / cardConfig.imageW).toFixed(4);
  // En modo «sin fondo» el contenido visible es la mitad superior del video
  // empaquetado: el plano toma la proporción de esa mitad si se conocen las
  // dimensiones del video; si no, la de la imagen de la tarjeta.
  const contentPlaneHeight =
    cardConfig.videoMode === 'alpha' && cardConfig.videoW > 0 && cardConfig.videoH > 0
      ? (cardConfig.videoH / 2 / cardConfig.videoW).toFixed(4)
      : planeHeight;

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
  #ar-root { position: fixed; inset: 0; display: none; background: #101014; }
  #ar-root.on { display: block; }
  #ar-root video { object-fit: cover; }
  .a-enter-vr, .a-enter-ar { display: none !important; }
  #scanner {
    position: fixed; inset: 0; display: none; z-index: 25;
    flex-direction: column; align-items: center; justify-content: center; gap: 20px;
    background: radial-gradient(ellipse at center, transparent 52%, rgba(5,5,8,.6) 100%);
    pointer-events: none;
  }
  #scanner.on { display: flex; }
  #scanFrame {
    position: relative; width: min(76vw, 330px); border-radius: 12px; overflow: hidden;
    --c: #e8b64c; --len: 30px; --th: 5px;
    background:
      linear-gradient(var(--c), var(--c)) left 0 top 0 / var(--len) var(--th),
      linear-gradient(var(--c), var(--c)) left 0 top 0 / var(--th) var(--len),
      linear-gradient(var(--c), var(--c)) right 0 top 0 / var(--len) var(--th),
      linear-gradient(var(--c), var(--c)) right 0 top 0 / var(--th) var(--len),
      linear-gradient(var(--c), var(--c)) left 0 bottom 0 / var(--len) var(--th),
      linear-gradient(var(--c), var(--c)) left 0 bottom 0 / var(--th) var(--len),
      linear-gradient(var(--c), var(--c)) right 0 bottom 0 / var(--len) var(--th),
      linear-gradient(var(--c), var(--c)) right 0 bottom 0 / var(--th) var(--len);
    background-repeat: no-repeat;
    animation: scanPulse 1.8s ease-in-out infinite;
  }
  @keyframes scanPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.025); } }
  .scanline {
    position: absolute; left: 4%; right: 4%; height: 4px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, #e8b64c, #ffe9a8, #e8b64c, transparent);
    box-shadow: 0 0 18px 5px rgba(232,182,76,.55);
    animation: scanSweep 1.6s ease-in-out infinite alternate;
  }
  @keyframes scanSweep { from { top: 3%; } to { top: 94%; } }
  #scanText {
    background: rgba(10,10,14,.75); color: #fff; padding: 10px 18px; border-radius: 999px;
    font-size: .95rem; backdrop-filter: blur(4px); text-align: center; max-width: 86vw;
  }
  #scanFallbackBtn { pointer-events: auto; margin-top: 0; }
  #soundHint {
    position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%);
    background: rgba(232,182,76,.95); color: #191408; padding: 9px 16px; border-radius: 999px;
    font-size: .9rem; font-weight: 700; display: none; z-index: 32; white-space: nowrap;
    box-shadow: 0 8px 22px rgba(0,0,0,.4); cursor: pointer; animation: scanPulse 1.4s ease-in-out infinite;
  }
  #soundHint.on { display: block; }
  .ctl.active { background: #e8b64c; }
  .ctl svg { width: 26px; height: 26px; display: block; }
  #photoFlash {
    position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none;
    transition: opacity .18s ease-out; z-index: 60;
  }
  #photoFlash.on { opacity: .85; transition: none; }
  #toast {
    position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
    background: rgba(10,10,14,.82); color: #fff; padding: 9px 18px; border-radius: 999px;
    font-size: .92rem; display: none; z-index: 61; backdrop-filter: blur(4px); white-space: nowrap;
  }
  #toast.on { display: block; }
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
  #fallback2d { position: fixed; inset: 0; display: none; background: #000; z-index: 40; overflow: hidden; }
  #fallback2d.on { display: block; }
  #fallback2d video { width: 100%; height: 100%; object-fit: contain; }
  /* Sin fondo en 2D: se muestra solo la mitad de color (sin transparencia). */
  #fallback2d.alpha2d video { height: 200%; object-fit: cover; object-position: top center; }
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
<div id="scanner">
  <div id="scanFrame" style="aspect-ratio: ${cardConfig.imageW} / ${cardConfig.imageH};"><div class="scanline"></div></div>
  <div id="scanText">🔍 Escaneando… apunta al frente de tu tarjeta</div>
  <button class="linklike" id="scanFallbackBtn" style="display:none">¿Tarda mucho? Ver el video directamente</button>
</div>
<div id="soundHint">Toca aquí para activar el sonido</div>
<div id="controls">
  <button class="ctl" id="soundBtn" title="Sonido"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zM461.64 256l45.64-45.64c6.3-6.3 6.3-16.52 0-22.82l-22.82-22.82c-6.3-6.3-16.52-6.3-22.82 0L416 210.36l-45.64-45.64c-6.3-6.3-16.52-6.3-22.82 0l-22.82 22.82c-6.3 6.3-6.3 16.52 0 22.82L370.36 256l-45.63 45.63c-6.3 6.3-6.3 16.52 0 22.82l22.82 22.82c6.3 6.3 16.52 0 22.82L416 301.64l45.64 45.64c6.3 6.3 16.52 0 22.82l22.82-22.82c6.3-6.3 6.3-16.52 0-22.82L461.64 256z"></path></svg></button>
  <button class="ctl" id="restartBtn" title="Reiniciar video"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M14 8C14 8.81 13.842 9.596 13.528 10.336C13.224 11.053 12.791 11.694 12.241 12.243C11.694 12.791 11.053 13.224 10.337 13.528C9.59602 13.841 8.81002 14 8.00002 14C7.19002 14 6.40402 13.842 5.66402 13.528C4.94702 13.224 4.30602 12.791 3.75702 12.242C3.20802 11.693 2.77602 11.053 2.47202 10.337C2.31002 9.956 2.48802 9.516 2.86902 9.354C3.25102 9.19 3.69002 9.37 3.85202 9.751C4.08102 10.288 4.40502 10.77 4.81802 11.181C5.23002 11.595 5.71202 11.919 6.24902 12.148C7.35602 12.615 8.64302 12.615 9.75202 12.148C10.288 11.919 10.77 11.595 11.181 11.183C11.595 10.77 11.919 10.288 12.148 9.751C12.381 9.197 12.501 8.608 12.501 8C12.501 7.392 12.382 6.803 12.148 6.248C11.919 5.712 11.595 5.23 11.182 4.819C10.77 4.405 10.288 4.081 9.75102 3.852C8.64402 3.385 7.35702 3.385 6.24802 3.852C5.71202 4.081 5.23002 4.405 4.81902 4.817C4.60802 5.027 4.42002 5.256 4.25702 5.5H6.24902C6.66302 5.5 6.99902 5.836 6.99902 6.25C6.99902 6.664 6.66302 7 6.24902 7H2.74902C2.33502 7 1.99902 6.664 1.99902 6.25V2.75C1.99902 2.336 2.33502 2 2.74902 2C3.16302 2 3.49902 2.336 3.49902 2.75V4.032C3.58202 3.938 3.66802 3.845 3.75802 3.757C4.30502 3.209 4.94602 2.776 5.66202 2.472C7.14402 1.845 8.85402 1.845 10.335 2.472C11.052 2.776 11.693 3.209 12.242 3.758C12.791 4.307 13.223 4.947 13.527 5.663C13.84 6.404 13.999 7.19 13.999 8H14Z"></path></svg></button>
  <button class="ctl" id="photoBtn" title="Guardar foto"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 8v-2a2 2 0 0 1 2 -2h2"></path><path d="M4 16v2a2 2 0 0 0 2 2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v2"></path><path d="M16 20h2a2 2 0 0 0 2 -2v-2"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path></svg></button>
  <button class="ctl" id="torchBtn" title="Linterna" style="display:none"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="M18 5V2H6v1.17L7.83 5zM16 11l2-3V7H9.83L16 13.17zM2.81 2.81 1.39 4.22 8 10.83V22h8v-3.17l3.78 3.78 1.41-1.41z"></path></svg></button>
</div>
<div id="photoFlash"></div>
<div id="toast"></div>

<div id="fallback2d"></div>

<script>
window.__CARD__ = ${JSON.stringify(cardConfig)};
(function () {
  var CARD = window.__CARD__;
  var token = null;
  var counted = false;
  var arVideo = null;
  var contentNodes = [];
  var lastVideoSrcAt = 0;
  var foundTimer = null;
  var targetVisible = false;
  var userWantsSound = false;
  var sceneEl = null;
  var torchTrack = null;
  var torchOn = false;

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
    $('scanner').classList.remove('on');
    $('controls').classList.remove('on');
    var box = $('fallback2d');
    box.classList.add('on');
    if (CARD.contentType === 'layers') { renderLayers2D(box); return; }
    if (CARD.contentType === 'model3d') { renderModel2D(box); return; }
    if (CARD.videoMode === 'alpha') box.classList.add('alpha2d');
    if (!box.querySelector('video')) {
      var v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('controls', '');
      v.setAttribute('autoplay', '');
      v.crossOrigin = 'anonymous';
      v.muted = true; // arranca solo y en silencio; el sonido se activa en los controles
      v.src = assetUrl('video');
      v.addEventListener('playing', function () { countView('2d'); });
      box.appendChild(v);
      var p = v.play();
      if (p) p.catch(function () { /* el invitado puede tocar play */ });
    }
  }

  function renderLayers2D(box) {
    if (box.dataset.done) return;
    box.dataset.done = '1';
    var stack = document.createElement('div');
    stack.style.cssText = 'position:absolute;inset:0;';
    CARD.layers.forEach(function (depth, i) {
      var img = document.createElement('img');
      img.src = assetUrl('layer') + '&i=' + i;
      img.alt = '';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';
      stack.appendChild(img);
    });
    box.appendChild(stack);
    countView('2d');
  }

  function renderModel2D(box) {
    if (box.dataset.done) return;
    box.dataset.done = '1';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;color:#f5f2ea;';
    if (CARD.posterUrl) {
      var img = document.createElement('img');
      img.src = CARD.posterUrl;
      img.alt = '';
      img.style.cssText = 'max-width:82%;max-height:55%;border-radius:12px;';
      wrap.appendChild(img);
    }
    var p = document.createElement('p');
    p.textContent = 'Este contenido es un modelo 3D: míralo sobre tu tarjeta con la cámara.';
    wrap.appendChild(p);
    var b = document.createElement('button');
    b.className = 'btn';
    b.textContent = '📷 Activar cámara';
    b.addEventListener('click', function () { location.reload(); });
    wrap.appendChild(b);
    box.appendChild(wrap);
    countView('2d');
  }

  // ------------- Modo AR -------------
  // Shader para video «sin fondo» empaquetado: mitad superior = color,
  // mitad inferior = máscara (blanco = visible). Un solo MP4 que funciona
  // igual en iPhone y Android (WebM/HEVC con alfa no son universales).
  function registerAlphaShader() {
    if (CARD.videoMode !== 'alpha' || typeof AFRAME === 'undefined') return false;
    if (AFRAME.shaders && AFRAME.shaders['tm-alpha']) return true;
    try {
      AFRAME.registerShader('tm-alpha', {
        schema: { map: { type: 'map', is: 'uniform' } },
        vertexShader: [
          'varying vec2 vUv;',
          'void main() {',
          '  vUv = uv;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}',
        ].join(' '),
        fragmentShader: [
          'uniform sampler2D map;',
          'varying vec2 vUv;',
          'void main() {',
          '  vec3 color = texture2D(map, vec2(vUv.x, vUv.y * 0.5 + 0.5)).rgb;',
          '  float alpha = texture2D(map, vec2(vUv.x, vUv.y * 0.5)).r;',
          '  gl_FragColor = vec4(color, alpha);',
          '}',
        ].join(' '),
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Reproduce en bucle la primera animación que traiga el modelo .glb.
  function registerGltfAnim() {
    if (typeof AFRAME === 'undefined') return;
    if (AFRAME.components && AFRAME.components['play-gltf-anim']) return;
    AFRAME.registerComponent('play-gltf-anim', {
      init: function () {
        var self = this;
        this.mixer = null;
        this.clock = null;
        this.el.addEventListener('model-loaded', function () {
          var obj = self.el.getObject3D('mesh');
          if (!obj || !obj.animations || !obj.animations.length || typeof THREE === 'undefined') return;
          self.mixer = new THREE.AnimationMixer(obj);
          self.mixer.clipAction(obj.animations[0]).play();
          self.clock = new THREE.Clock();
        });
      },
      tick: function () {
        if (this.mixer && this.clock) this.mixer.update(this.clock.getDelta());
      },
    });
  }

  function buildScene() {
    var root = $('ar-root');
    var planeH = ${contentPlaneHeight};
    var imgPlaneH = ${planeHeight};
    var assets = '';
    var content = '';

    if (CARD.contentType === 'layers') {
      CARD.layers.forEach(function (depth, i) {
        assets += '<img id="layer' + i + '" src="' + assetUrl('layer') + '&i=' + i + '" crossorigin="anonymous">';
        var z = (0.01 + depth * 0.12).toFixed(3);
        content += '<a-plane class="content-node" visible="false" position="0 0 ' + z + '" width="1" height="' + imgPlaneH + '" material="shader: flat; src: #layer' + i + '; transparent: true"></a-plane>';
      });
    } else if (CARD.contentType === 'model3d') {
      registerGltfAnim();
      var s = CARD.modelScale;
      var rot = CARD.modelUpright
        ? '-90 ' + CARD.modelRotationY + ' 0'
        : '0 0 ' + CARD.modelRotationY;
      content = '<a-entity class="content-node" id="model3d" visible="false" gltf-model="url(' + assetUrl('model') + ')" position="0 0 0.02" rotation="' + rot + '" scale="' + s + ' ' + s + ' ' + s + '" play-gltf-anim></a-entity>';
    } else {
      var useAlpha = CARD.videoMode === 'alpha' && registerAlphaShader();
      var planeMaterial = useAlpha
        ? 'shader: tm-alpha; map: #arvideo; transparent: true'
        : 'shader: flat; src: #arvideo';
      assets = '<video id="arvideo" preload="auto" loop muted playsinline webkit-playsinline crossorigin="anonymous"></video>';
      content = '<a-plane class="content-node" id="vplane" visible="false" position="0 0 0.01" width="1" height="' + planeH + '" material="' + planeMaterial + '"></a-plane>';
    }

    root.innerHTML =
      '<a-scene mindar-image="imageTargetSrc: ' + assetUrl('marker') + '; autoStart: false; uiScanning: none; uiLoading: none;" ' +
      'embedded vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false" loading-screen="enabled: false" ' +
      'color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights">' +
      '<a-assets>' + assets + '</a-assets>' +
      '<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
      '<a-entity id="target" mindar-image-target="targetIndex: 0">' +
      content +
      '</a-entity></a-scene>';

    contentNodes = Array.prototype.slice.call(root.querySelectorAll('.content-node'));
    arVideo = root.querySelector('#arvideo');
    if (arVideo) {
      arVideo.addEventListener('playing', function () { countView('ar'); });
    }
    var target = root.querySelector('#target');

    target.addEventListener('targetFound', function () {
      targetVisible = true;
      setupTorch();
      $('scanner').classList.remove('on');
      if (navigator.vibrate) navigator.vibrate(50);
      contentNodes.forEach(function (n) { n.setAttribute('visible', true); });
      foundTimer = setTimeout(function () {
        if (!targetVisible) return;
        if (CARD.contentType === 'video') {
          playArVideo();
        } else {
          countView('ar'); // capas/3D: la vista se cuenta al exhibirse estable (§6.1)
        }
      }, 800); // §6.1: detección sostenida ≥ 800 ms
    });
    target.addEventListener('targetLost', function () {
      targetVisible = false;
      if (foundTimer) clearTimeout(foundTimer);
      if (arVideo) arVideo.pause();
      contentNodes.forEach(function (n) { n.setAttribute('visible', false); });
      $('soundHint').classList.remove('on');
      $('scanner').classList.add('on');
    });

    var scene = root.querySelector('a-scene');
    sceneEl = scene;
    return scene;
  }

  // ------------- Linterna y foto -------------
  function findCameraVideo() {
    var vids = document.querySelectorAll('#ar-root video');
    for (var i = 0; i < vids.length; i++) {
      if (vids[i].srcObject) return vids[i]; // el feed de la cámara (no #arvideo)
    }
    return null;
  }

  function setupTorch() {
    if (torchTrack) return;
    var v = findCameraVideo();
    if (!v || !v.srcObject || !v.srcObject.getVideoTracks) return;
    var track = v.srcObject.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return;
    var caps = track.getCapabilities();
    if (caps && caps.torch) {
      torchTrack = track;
      $('torchBtn').style.display = 'flex';
    }
    // Sin soporte (p. ej. iPhone) el botón simplemente no aparece.
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  function takePhoto() {
    if (!sceneEl || !sceneEl.canvas || !sceneEl.renderer) {
      toast('La cámara aún no está lista');
      return;
    }
    try {
      // Re-renderizar justo antes de capturar: permite leer el lienzo WebGL
      // sin preserveDrawingBuffer.
      sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);
      var glCanvas = sceneEl.canvas;
      var cam = findCameraVideo();
      var w = (cam && cam.videoWidth) || glCanvas.width;
      var h = (cam && cam.videoHeight) || glCanvas.height;
      var out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      var ctx = out.getContext('2d');
      if (cam) ctx.drawImage(cam, 0, 0, w, h);
      ctx.drawImage(glCanvas, 0, 0, w, h);
      $('photoFlash').classList.add('on');
      setTimeout(function () { $('photoFlash').classList.remove('on'); }, 190);
      out.toBlob(function (blob) {
        if (!blob) { toast('No se pudo guardar la foto'); return; }
        var file = new File([blob], 'tarjeta-' + CARD.slug + '.jpg', { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file] }).catch(function () {});
        } else {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        }
        toast('📸 Foto lista');
      }, 'image/jpeg', 0.92);
    } catch (e) {
      toast('No se pudo tomar la foto');
    }
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
    // El video SIEMPRE arranca silenciado (el navegador lo permite sin
    // fricción); el sonido lo activa el invitado con un toque, y si ya lo
    // activó antes, se respeta su elección.
    arVideo.muted = !userWantsSound;
    var onPlaying = function () {
      updateSoundBtn();
      $('soundHint').classList.toggle('on', !!arVideo.muted);
    };
    var p = arVideo.play();
    if (p) {
      p.then(onPlaying).catch(function () {
        arVideo.muted = true;
        var p2 = arVideo.play();
        if (p2) p2.then(onPlaying).catch(function () {});
        updateSoundBtn();
      });
    } else {
      onPlaying();
    }
    $('controls').classList.add('on');
  }

  var ICON_SOUND_ON = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" xmlns="http://www.w3.org/2000/svg"><path d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zm233.32-51.08c-11.17-7.33-26.18-4.24-33.51 6.95-7.34 11.17-4.22 26.18 6.95 33.51 66.27 43.49 105.82 116.6 105.82 195.58 0 78.98-39.55 152.09-105.82 195.58-11.17 7.32-14.29 22.34-6.95 33.5 7.04 10.71 21.93 14.56 33.51 6.95C528.27 439.58 576 351.33 576 256S528.27 72.43 448.35 19.97zM480 256c0-63.53-32.06-121.94-85.77-156.24-11.19-7.14-26.03-3.82-33.12 7.46s-3.78 26.21 7.41 33.36C408.27 165.97 432 209.11 432 256s-23.73 90.03-63.48 115.42c-11.19 7.14-14.5 22.07-7.41 33.36 6.51 10.36 21.12 15.14 33.12 7.46C447.94 377.94 480 319.54 480 256zm-141.77-76.87c-11.58-6.33-26.19-2.16-32.61 9.45-6.39 11.61-2.16 26.2 9.45 32.61C327.98 228.28 336 241.63 336 256c0 14.38-8.02 27.72-20.92 34.81-11.61 6.41-15.84 21-9.45 32.61 6.43 11.66 21.05 15.8 32.61 9.45 28.23-15.55 45.77-45 45.77-76.88s-17.54-61.32-45.78-76.86z"></path></svg>';
  var ICON_SOUND_OFF = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zM461.64 256l45.64-45.64c6.3-6.3 6.3-16.52 0-22.82l-22.82-22.82c-6.3-6.3-16.52-6.3-22.82 0L416 210.36l-45.64-45.64c-6.3-6.3-16.52-6.3-22.82 0l-22.82 22.82c-6.3 6.3-6.3 16.52 0 22.82L370.36 256l-45.63 45.63c-6.3 6.3-6.3 16.52 0 22.82l22.82 22.82c6.3 6.3 16.52 0 22.82L416 301.64l45.64 45.64c6.3 6.3 16.52 0 22.82l22.82-22.82c6.3-6.3 6.3-16.52 0-22.82L461.64 256z"></path></svg>';
  var ICON_FLASH_ON = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="M6 2h12v3H6zM6 7v1l2 3v11h8V11l2-3V7zm6 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5"></path></svg>';
  var ICON_FLASH_OFF = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="M18 5V2H6v1.17L7.83 5zM16 11l2-3V7H9.83L16 13.17zM2.81 2.81 1.39 4.22 8 10.83V22h8v-3.17l3.78 3.78 1.41-1.41z"></path></svg>';

  function updateSoundBtn() {
    $('soundBtn').innerHTML = arVideo && !arVideo.muted ? ICON_SOUND_ON : ICON_SOUND_OFF;
  }

  function startAR() {
    if (typeof AFRAME === 'undefined' || typeof MINDAR === 'undefined') {
      start2D();
      return;
    }
    $('welcome').style.display = 'none';
    $('ar-root').classList.add('on');
    $('scanner').classList.add('on');
    $('controls').classList.add('on'); // la linterna sirve ya durante el escaneo
    if (CARD.contentType !== 'video') {
      $('soundBtn').style.display = 'none'; // sin video no hay sonido ni reinicio
      $('restartBtn').style.display = 'none';
    }
    var scene = buildScene();
    // Precargar el video desde ya (silenciado) para que al detectar la
    // tarjeta arranque casi al instante.
    try {
      arVideo.src = assetUrl('video');
      lastVideoSrcAt = Date.now();
    } catch (e) { /* se reintenta al reproducir */ }
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
    setTimeout(setupTorch, 1500); // el stream ya existe: revisar si hay linterna
    // Red de seguridad: si en 12 s no detecta la tarjeta, ofrecer el 2D.
    setTimeout(function () {
      if (!targetVisible && !counted && $('ar-root').classList.contains('on')) {
        $('scanText').textContent = 'Sigue buscando… acércate y centra el frente de la tarjeta';
        $('scanFallbackBtn').style.display = 'block';
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
    userWantsSound = !arVideo.muted;
    if (!arVideo.muted) {
      var p = arVideo.play();
      if (p) p.catch(function () {});
      $('soundHint').classList.remove('on');
    }
    updateSoundBtn();
  });

  $('soundHint').addEventListener('click', function () {
    $('soundBtn').click();
  });

  $('scanFallbackBtn').addEventListener('click', function () {
    start2D(); // la sesión ya existe: se llegó aquí desde «Activar cámara»
  });

  $('torchBtn').addEventListener('click', function () {
    if (!torchTrack) { setupTorch(); if (!torchTrack) return; }
    torchOn = !torchOn;
    torchTrack.applyConstraints({ advanced: [{ torch: torchOn }] })
      .then(function () {
        $('torchBtn').classList.toggle('active', torchOn);
        $('torchBtn').innerHTML = torchOn ? ICON_FLASH_ON : ICON_FLASH_OFF;
      })
      .catch(function () { torchOn = !torchOn; });
  });

  $('photoBtn').addEventListener('click', function () {
    takePhoto();
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
