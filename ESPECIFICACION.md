# Tarjetas Mágicas — Especificación del producto y de la plataforma

> Estado: especificación v1 para construir el MVP.
> Base técnica actual: las experiencias demo de este repo (`cr7/`, `messi/`) hechas con MindAR + A-Frame.
> Objetivo: convertir ese demo en una plataforma Node.js que produzca tarjetas físicas con realidad aumentada, vendibles por redes sociales para eventos.

---

## 1. El producto

### 1.1 Qué es

Una **tarjeta impresa personalizada** (o un pack de tarjetas idénticas) para un evento —boda, cumpleaños, XV años, baby shower, graduación, aniversario— que «cobra vida»:

- **Al frente:** la imagen del evento (foto de los novios, del cumpleañero, invitación, etc.). Esa imagen es, en secreto, el **marcador** de realidad aumentada.
- **Atrás:** un **código QR** (y la URL corta escrita) que abre la experiencia en el navegador del celular. **Sin instalar ninguna app.**
- El invitado escanea el QR, acepta el permiso de cámara, apunta al frente de la tarjeta y **el video se reproduce encima de la imagen**, anclado a ella, como si la foto hablara.

### 1.2 Propuesta de valor (lo que se vende)

- No se vende «una tarjeta con un QR»: se vende **el momento** en que la foto del evento cobra vida frente a los invitados. El material de venta es un video de 10–15 s mostrando exactamente eso.
- Cero fricción para el invitado: sin apps, sin cuentas, sin contraseñas.
- El comprador (anfitrión del evento) recibe las tarjetas listas; no necesita saber nada de tecnología.

### 1.3 Modelo de negocio

| Línea | Descripción |
|---|---|
| **Pack impreso** | N tarjetas físicas idénticas + experiencia AR activada + un cupo de vistas incluido. Es el producto principal. |
| **Pack digital** | Solo la experiencia (imagen, marcador y QR en archivos listos para imprimir). El cliente imprime por su cuenta. Más barato; sirve de entrada. |
| **Recargas de vistas** | Ingreso recurrente: cuando una tarjeta agota su cupo, el anfitrión compra paquetes de **50 / 100 / 200 vistas** por WhatsApp. Los precios se configuran en el panel (no están fijos en el código). |

- Las vistas **no caducan** por defecto. La experiencia permanece activa **12 meses** desde su activación (configurable), para acotar el costo de hosting en el tiempo.
- Precios: los define el dueño en el panel (§5.4). La especificación no fija montos.

### 1.4 Conceptos clave (glosario)

| Concepto | Significado |
|---|---|
| **Tarjeta** (entidad central) | Una experiencia completa: imagen + video + marcador + cupo. Un pack físico de 100 tarjetas impresas corresponde a **una** tarjeta en el sistema (comparten imagen, video y cupo). |
| **Marcador** | Archivo `.mind` compilado desde la imagen. Es lo que la cámara reconoce. |
| **QR** | Solo es el enlace: codifica la URL pública de la experiencia (`/v/<slug>`). No contiene la experiencia. |
| **Experiencia** | La página pública que abre el invitado y que ejecuta el AR. |
| **Vista** | Una visualización real y contada del video, según la definición exacta de §6. Ni abrir el enlace ni escanear el QR cuentan como vista por sí solos. |
| **Cupo** | Número de vistas disponibles de una tarjeta (`quota`). Al llegar a 0, la experiencia se bloquea (§4.4) hasta que haya una recarga. |
| **Recarga** | Compra de un paquete de vistas que suma cupo a una tarjeta. En la v1 se vende por WhatsApp y la aplica el administrador manualmente desde el panel. |

---

## 2. Usuarios y roles

| Rol | Quién es | Qué hace |
|---|---|---|
| **Administrador** | El dueño del negocio (una sola cuenta en el MVP) | Crea y gestiona tarjetas, define precios, aplica recargas, ve estadísticas. |
| **Comprador / anfitrión** | El cliente que paga el pack | Entrega foto y video, recibe las tarjetas, pide recargas por WhatsApp. No tiene cuenta en la plataforma en el MVP. |
| **Invitado** | Quien recibe una tarjeta en el evento | Escanea el QR y vive la experiencia. Anónimo, sin cuenta. |

---

## 3. Alcance

### 3.1 Dentro del MVP

1. Panel de administración web con login.
2. Crear/editar/pausar/eliminar tarjetas subiendo **solo imagen y video**; el marcador se compila automáticamente.
3. Compresión automática del video al subirlo y generación del póster (imagen de portada del video).
4. Página pública de experiencia por tarjeta (`/v/<slug>`) generada desde una plantilla única (la evolución de las páginas `cr7/` y `messi/` de este repo).
5. Contador de vistas por tarjeta con cupo, deduplicación anti-abuso y registro de eventos.
6. Bloqueo elegante al agotar el cupo, con botón de WhatsApp para recarga.
7. Paquetes de recarga 50/100/200 con precios editables en el panel; aplicar recargas manualmente.
8. Generación y descarga del QR de cada tarjeta (PNG y SVG) listo para imprenta.
9. Ajustes del negocio: número de WhatsApp, nombre comercial, mensaje prellenado de recarga, cupo incluido por defecto, meses de vigencia.
10. Estadísticas básicas por tarjeta: vistas totales, vistas hoy, última vista, historial de recargas.

### 3.2 Fuera del MVP (v2, no construir ahora)

- Pasarela de pagos en línea (la recarga v1 es manual por WhatsApp).
- Cuentas de cliente / autoservicio para anfitriones.
- Diseñador visual de la tarjeta (plantillas de frente/reverso). En el MVP el cliente aporta el arte o se diseña fuera de la plataforma.
- Multi-vendedor / SaaS para terceros.
- Varios videos por tarjeta, experiencias 3D, filtros faciales (MindAR face tracking) — la arquitectura no debe impedirlos, pero no se construyen.
- App nativa.

---

## 4. Flujos principales

### 4.1 Flujo del comprador (venta)

1. Ve el producto en redes → escribe por WhatsApp.
2. Envía: **la imagen** (la que irá impresa al frente) y **el video** (vertical recomendado), más los datos del evento (nombre, fecha).
3. El administrador crea la tarjeta en el panel (§4.2), imprime el pack con el QR generado por el panel (§5.5) y lo entrega.
4. En el evento, los invitados viven la experiencia (§4.3).
5. Si el cupo se agota y quiere más, recarga (§4.4).

### 4.2 Flujo del administrador: crear una tarjeta

1. Panel → **Nueva tarjeta**.
2. Completa: título interno (ej. «Boda Ana & Luis — 2026-12-05»), nombre del cliente, tipo de evento, fecha del evento.
3. Sube la **imagen** (JPG/PNG, §7.1) y el **video** (MP4/WebM, §7.2). Nada más: no se pide el `.mind`.
4. El sistema, automáticamente:
   a. Valida formatos y tamaños.
   b. **Compila el marcador** `.mind` desde la imagen (§8.3) y calcula su **calidad de seguimiento** (cantidad de puntos característicos). Si la calidad es baja, avisa antes de activar: «esta imagen puede fallar al escanearla; pide una con más detalle/contraste». El admin decide si continúa.
   c. **Comprime el video** con ffmpeg a un máximo listo para streaming móvil y extrae el **póster** (primer frame nítido).
   d. Genera el **slug** público (código corto no adivinable, ej. `boda-ana-luis-x7k2`).
   e. Genera el **QR** de `/v/<slug>`.
5. El admin asigna el **cupo inicial** (por defecto, el de los ajustes) y **activa** la tarjeta.
6. Descarga el kit de imprenta: imagen frente (la original) + QR en PNG/SVG (§5.5).

### 4.3 Flujo del invitado (la experiencia)

1. Escanea el QR trasero (o escribe la URL corta) → se abre `/v/<slug>` en su navegador.
2. Pantalla de bienvenida **ultrabreve**: nombre del evento, una instrucción visual («Apunta la cámara a la tarjeta») y un botón grande **«Activar cámara»**. Nada más compite por su atención.
   - El botón cumple además una función técnica: el gesto del usuario permite pedir la cámara y reproducir video con sonido en iOS/Android.
3. Acepta el permiso de cámara → se abre la vista AR con una guía en pantalla («Busca el frente de la tarjeta»).
4. Al detectar el marcador: el video aparece sobre la tarjeta y suena. **Ahí se cuenta la vista** (§6).
   - Si el marcador se pierde y vuelve, el video se pausa y continúa (comportamiento ya presente en el demo).
5. Controles mínimos sobre la vista: botón de sonido (silencio/activar), botón de reiniciar el video. Nada de menús.
6. **Respaldo sin AR:** si el navegador no soporta AR, niega la cámara o algo falla, la página muestra el video en pantalla completa normal (2D) con controles. **Nadie se queda sin ver el video.** Esa visualización también cuenta como vista (§6).

### 4.4 Flujo de agotamiento y recarga

1. Cuando el cupo llega a 0, la experiencia deja de servir el marcador y el video.
2. Quien abra el enlace verá una pantalla amable: «Esta tarjeta ya alcanzó su límite de visualizaciones 💛» + **botón de WhatsApp** «Recargar vistas» que abre `wa.me/<número del negocio>` con un mensaje prellenado: tarjeta (título y código), y los paquetes disponibles con su precio actual (leídos de los ajustes, §5.4).
   - El mensaje va dirigido a que lo envíe el **anfitrión**; el texto lo deja claro («Soy el anfitrión de…»).
3. El anfitrión paga por el medio acordado en el chat (transferencia, Nequi, etc. — fuera de la plataforma).
4. El administrador, en el panel, entra a la tarjeta → **Aplicar recarga** → elige el paquete (50/100/200) o una cantidad manual → el cupo aumenta al instante y la experiencia vuelve a funcionar sin tocar la tarjeta impresa (el QR no cambia).
5. La recarga queda registrada en el historial (fecha, paquete, cantidad, precio cobrado).

---

## 5. Panel de administración — requisitos funcionales

### 5.1 Acceso

- Login con usuario + contraseña (una sola cuenta administradora en el MVP; contraseña con hash bcrypt y sesión por cookie segura).
- Protección básica contra fuerza bruta (límite de intentos por IP).

### 5.2 Lista de tarjetas

- Tabla con: póster/miniatura, título, cliente, evento y fecha, estado, **vistas consumidas / cupo** (barra de progreso), última vista, acciones (ver experiencia, editar, recargar, pausar, QR, eliminar).
- Buscador por título/cliente y filtro por estado.
- Aviso visual de tarjetas **a punto de agotarse** (≤10 % de cupo o ≤10 vistas).

### 5.3 Crear / editar tarjeta

- Campos: título interno, cliente, tipo de evento (boda, cumpleaños, XV años, baby shower, graduación, aniversario, otro), fecha del evento, notas internas.
- Subida de imagen y video con vista previa y validaciones de §7. Reemplazar el video o la imagen de una tarjeta activa **regenera** marcador/póster y conserva slug, cupo e historial.
- Cupo inicial editable al crear; después solo cambia por recargas o ajuste manual registrado.
- Estados: `borrador` (no pública), `activa`, `pausada` (el admin la apaga temporalmente), `agotada` (automático al llegar a 0; vuelve a `activa` con una recarga), `archivada` (fin de vigencia; no cuenta ni se muestra en la lista principal).

### 5.4 Ajustes del negocio

- Nombre comercial (se muestra en la experiencia y en el mensaje de bloqueo).
- **Número de WhatsApp** del negocio (formato internacional, para `wa.me`).
- **Precios de los paquetes**: tres filas editables — vistas (50, 100, 200 por defecto; la cantidad también es editable) y precio de cada una. Se usan en el mensaje de WhatsApp y al aplicar recargas.
- Cupo incluido por defecto en tarjetas nuevas.
- Meses de vigencia de una experiencia (12 por defecto).
- Mensaje de bloqueo y mensaje de WhatsApp: editables con variables `{tarjeta}`, `{codigo}`, `{paquetes}`.

### 5.5 Kit de imprenta por tarjeta

- Descargar **QR en PNG** (alta resolución, con margen/zona de silencio correcta para imprenta) y **SVG**.
- Descargar la imagen frente tal como se subió (la que debe imprimirse **sin recortes, filtros ni cambios de proporción**: cualquier alteración degrada el reconocimiento).
- Texto de instrucciones listo para pegar en el reverso junto al QR: «1. Escanea el código 2. Toca "Activar cámara" 3. Apunta al frente de esta tarjeta 📱✨».

### 5.6 Estadísticas e historial

- Por tarjeta: total de vistas, vistas por día (últimos 30 días, gráfico simple o tabla), última vista, dispositivos aproximados (móvil Android/iOS, por user-agent agregado, sin datos personales).
- Historial de recargas y ajustes de cupo por tarjeta.

---

## 6. La vista: definición exacta y control de cupo

Esta es la regla de negocio más delicada: de ella depende que el cupo sea justo para el cliente y rentable para el negocio.

### 6.1 Cuándo se cuenta una vista

Se cuenta **una** vista cuando ocurre la primera de estas dos cosas en una sesión de experiencia:

- **AR:** el marcador es detectado de forma estable (evento `targetFound` sostenido ≥ 800 ms) y el video comienza a reproducirse; **o**
- **Respaldo 2D:** el video comienza a reproducirse en modo pantalla completa.

**No cuentan:** abrir el enlace, escanear el QR, ver la pantalla de bienvenida, pedir la cámara y cerrar, errores de carga, ni la detección fugaz del marcador (< 800 ms).

### 6.2 Deduplicación (anti-abuso y justicia)

- Al abrirse, la experiencia recibe del servidor un **token de sesión firmado** de corta duración.
- El conteo se registra en el servidor con ese token: **una sesión = máximo una vista**, así refrescar la página no quema cupo.
- Además: el mismo dispositivo (identificador anónimo guardado en el navegador) no puede generar más de **1 vista contada cada 10 minutos** por tarjeta (configurable), aunque abra sesiones nuevas. Suficiente para que el anfitrión demuestre la tarjeta sin quemar el cupo de sus invitados, y para frenar abuso deliberado.
- Se ignoran conteos de bots conocidos (user-agents de crawlers/prefetch) y de la red del propio admin si está marcada.

### 6.3 Control de cupo (en el servidor, no en el cliente)

- El servidor **no entrega** el `.mind` ni el video si la tarjeta no está `activa` o su cupo es 0: se sirven mediante endpoints que verifican estado y cupo (`/v/<slug>/assets/...`), no como archivos estáticos públicos directos.
- El decremento del cupo es **atómico** en la base de datos (una sola operación que verifica `quota > 0` y resta), para que dos invitados simultáneos no puedan gastar la misma última vista dos veces.
- Si el conteo falla por red justo al reproducir, el video no se bloquea a mitad de reproducción: el conteo es optimista en el cliente y autoritativo en el servidor en el siguiente acceso.

---

## 7. Requisitos de los archivos que sube el cliente

### 7.1 Imagen (frente de la tarjeta y marcador)

- Formatos: JPG o PNG. Tamaño máximo: 10 MB. Resolución recomendada: ≥ 1200 px en su lado menor.
- Debe tener **detalle y contraste** (fotos con zonas planas o muy oscuras se reconocen mal). El sistema avisa si la calidad del marcador compilado es baja (§4.2 paso 4b), pero la decisión final es del admin.
- Proporción libre; la experiencia ajusta el plano de video a la proporción real de la imagen (el demo actual usa 1×2 fijo: eso se parametriza por tarjeta).

### 7.2 Video (o animación)

- Formatos de entrada: MP4, WebM o MOV. El sistema lo convierte siempre a **MP4 (H.264) + versión WebM opcional**, vertical u horizontal según el original, máx. **720p** y máx. **8 MB** tras compresión (objetivo: que cargue en el wifi de un salón de eventos).
- Duración recomendada: 15–60 s. Máximo aceptado: 90 s.
- Orientación: se recomienda que coincida con la de la imagen (si la foto es vertical, video vertical) para que el encaje se vea natural.
- Audio: se conserva. En móvil arranca tras el gesto de «Activar cámara»; si el navegador lo bloquea, arranca silenciado con botón de sonido visible.

---

## 8. Arquitectura técnica propuesta (MVP)

### 8.1 Stack

- **Node.js 20+ con Express** (mismo stack que Lyam ya usa en Aurora: curva de aprendizaje cero).
- **SQLite** (archivo único, vía `better-sqlite3` o el `node:sqlite` de Node 22+) para el MVP: cero configuración, copias de seguridad triviales. Migrable a Postgres si el volumen lo exige (la capa de datos se aísla en un módulo `store`).
- **Frontend**: HTML/CSS/JS sin framework, como el panel de Aurora — un solo archivo por vista si es práctico. La experiencia usa **MindAR 1.2.2 + A-Frame 1.4.2** servidos localmente (no desde CDN público, para no depender de terceros el día del evento).
- **ffmpeg** en el servidor para compresión de video y extracción del póster.
- **Librería `qrcode`** para generar el QR (PNG/SVG).
- Almacenamiento de archivos en disco bajo `DATA_DIR` (imagen, `.mind`, video, póster por tarjeta). Estructura preparada para mover a S3/R2 después (URLs siempre generadas por la app, nunca rutas físicas expuestas).

### 8.2 Rutas principales

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Público | Página comercial simple del negocio (qué es, ejemplos, botón de WhatsApp). |
| `/v/<slug>` | Invitados | La experiencia. HTML generado por tarjeta (plantilla única). |
| `/v/<slug>/assets/marker.mind` | Invitados | Sirve el marcador **solo si** la tarjeta está activa y con cupo (cabeceras anti-caché adecuadas). |
| `/v/<slug>/assets/video.mp4` | Invitados | Sirve el video con soporte de `Range` (streaming), mismas verificaciones. |
| `/v/<slug>/assets/poster.jpg` | Invitados | Póster para la pantalla de bienvenida y el respaldo 2D. |
| `/api/v/<slug>/session` | Invitados | Crea la sesión firmada de experiencia y devuelve el estado (activa/agotada/pausada). |
| `/api/v/<slug>/view` | Invitados | Registra la vista (token de sesión; aplica §6). |
| `/admin` | Admin | Panel (login, tarjetas, ajustes, estadísticas). |
| `/api/admin/...` | Admin | CRUD de tarjetas, subida de archivos, recargas, ajustes, QR. |

### 8.3 Compilación automática del marcador (decisión técnica clave)

El cliente **nunca** sube un `.mind`: solo imagen y video. Hay dos vías para compilarlo sin intervención humana, y el MVP implementa la primera que pase el spike de validación (hito M0, §11):

1. **En el servidor (preferida):** ejecutar el compilador oficial de MindAR en Node durante la creación de la tarjeta (proceso en segundo plano; la tarjeta pasa a `activa` cuando el marcador está listo). Ventaja: flujo 100 % automático en un solo paso.
2. **En el navegador del admin (respaldo garantizado):** el panel compila la imagen con el compilador web oficial de MindAR mientras el admin rellena el formulario, y sube el `.mind` junto con la imagen y el video. Para el admin el flujo es idéntico («subir imagen y video»); la compilación es invisible.

En ambos casos se guarda también la **imagen original** (la que se imprime) y se calcula la métrica de calidad del marcador para el aviso de §4.2.

### 8.4 Modelo de datos (SQLite)

**`cards`** — una fila por tarjeta:

| Campo | Notas |
|---|---|
| `id`, `slug` (único) | slug público no adivinable |
| `title`, `client_name`, `event_type`, `event_date`, `notes` | datos de gestión |
| `image_path`, `marker_path`, `video_path`, `poster_path` | rutas internas bajo `DATA_DIR` |
| `image_w`, `image_h`, `marker_quality` | proporción del plano y calidad de seguimiento |
| `quota_total`, `views_used` | cupo y consumo (el saldo = `quota_total - views_used`) |
| `status` | `borrador` / `activa` / `pausada` / `agotada` / `archivada` |
| `activated_at`, `expires_at` | vigencia |
| `created_at`, `updated_at` | |

**`view_events`** — un registro por vista contada: `card_id`, `session_id`, `mode` (`ar`/`2d`), `device_class` (`ios`/`android`/`otro`), `created_at`. Sirve para estadísticas y para auditar el cupo (el contador de `cards` debe poder reconstruirse desde aquí).

**`recharges`** — `card_id`, `pack_label` (ej. «100 vistas»), `views_added`, `price_charged`, `note`, `created_at`.

**`settings`** — clave/valor: `business_name`, `whatsapp_number`, `pack_1_views`, `pack_1_price`, `pack_2_views`, `pack_2_price`, `pack_3_views`, `pack_3_price`, `default_quota`, `validity_months`, `dedupe_minutes`, textos de bloqueo/WhatsApp.

**`admin_users`** — `username`, `password_hash` (bcrypt). Una fila en el MVP.

### 8.5 Estructura de carpetas propuesta

```
scanner_ar/
├── cr7/  messi/            # demos originales (referencia y plantilla)
├── ESPECIFICACION.md       # este documento
├── package.json
├── src/
│   ├── index.js            # arranque Express, rutas públicas
│   ├── store.js            # capa de datos (SQLite)
│   ├── cards.js            # lógica de tarjetas y cupo (§6)
│   ├── media.js            # ffmpeg: compresión y póster; compilación del marcador
│   ├── qr.js               # generación de QR
│   ├── admin.js            # API del panel
│   └── views/
│       ├── experience.html # plantilla de /v/<slug> (MindAR + A-Frame)
│       └── admin.html      # panel (un solo archivo)
├── data/                   # DATA_DIR (fuera de git): uploads por tarjeta + SQLite
└── tests/
```

### 8.6 Despliegue

- Un solo proceso Node con `DATA_DIR` persistente (mismo patrón que Aurora: VPS pequeño, Docker o servicio systemd + Caddy/Nginx con **HTTPS obligatorio** — sin HTTPS ningún navegador da acceso a la cámara).
- Requisito duro: el dominio debe ser **estable** — los QR impresos apuntan a él para siempre. Cambiar de dominio invalida las tarjetas en la calle. Elegir dominio propio desde el día uno.
- Copias de seguridad: carpeta `data/` completa (archivos + SQLite).

---

## 9. Requisitos no funcionales

- **Rendimiento:** la experiencia debe mostrar la cámara en ≤ 3 s en 4G con el video ya en búfer progresivo; peso total inicial de la página (sin video) ≤ 1,5 MB. MindAR/A-Frame se sirven localmente y con caché larga (son inmutables por versión).
- **Compatibilidad:** Safari iOS 16+ y Chrome Android recientes como objetivo principal (es el parque real de los invitados). Probar también Samsung Internet y navegadores in-app de Instagram/WhatsApp, con el respaldo 2D (§4.3 paso 6) como red de seguridad.
- **Seguridad:** panel tras login con sesiones seguras; subida de archivos validada por tipo real (no solo extensión) y con límites de tamaño; slugs no secuenciales; endpoints de conteo con rate-limit; cabeceras `Cache-Control` que eviten que el video/marcador queden en cachés públicas.
- **Privacidad:** no se recogen datos personales de los invitados. Solo conteos agregados y clase de dispositivo. Sin cookies de terceros en la experiencia.
- **Disponibilidad:** es un producto de «momento único» (el día del evento): el hosting debe estar despierto siempre (nada de planes que duerman el servicio).

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación (ya incluida en esta spec) |
|---|---|
| Foto con poco detalle → el AR no la reconoce en el evento | Métrica de calidad al crear (§4.2) + aviso al admin + recomendación de imágenes con contraste; probar siempre con la tarjeta **impresa** antes de entregar el pack. |
| La imprenta recorta o altera la imagen → el marcador deja de coincidir | Kit de imprenta con la imagen exacta (§5.5) e instrucción de imprimir sin recorte ni filtros; incluir márgenes de seguridad en el diseño. |
| Wifi del salón lento → el video tarda | Compresión agresiva (§7.2), póster inmediato, carga progresiva y mensaje «cargando…» amable. |
| iOS bloquea audio/cámara | Botón «Activar cámara» como gesto inicial (§4.3), video que arranca silenciado si hace falta y botón de sonido. |
| Un invitado (o un bot) quema el cupo refrescando | Definición de vista (§6.1) + token de sesión + deduplicación por dispositivo (§6.2). |
| Se cae el servidor el día del evento | Hosting siempre activo (§9) + copias de `data/`; plan B documentado: el respaldo 2D depende del mismo servidor, así que la disponibilidad es **el** requisito crítico. |
| Cambiar de dominio/hosting con tarjetas ya impresas | Dominio propio estable desde el inicio (§8.6); los slugs no cambian nunca. |

---

## 11. Plan de construcción (hitos verificables)

| Hito | Contenido | Criterio de aceptación |
|---|---|---|
| **M0 — Spike técnico** | Validar la compilación del marcador en servidor (§8.3 vía 1); si no es viable, confirmar la vía 2. Comprimir un video de prueba con ffmpeg. | Un script que, dada una imagen, produce un `.mind` que MindAR reconoce en un celular real. |
| **M1 — Núcleo** | Express + SQLite + login admin + CRUD de tarjetas con subida de imagen/video, compresión, póster y marcador. | Crear una tarjeta completa desde el panel sin tocar archivos a mano. |
| **M2 — Experiencia** | Plantilla `/v/<slug>` con bienvenida, AR, respaldo 2D y controles; activos servidos con verificación de estado/cupo. | Con una tarjeta impresa de prueba, un invitado completa el flujo en iOS y Android. |
| **M3 — Cupo y recargas** | Sesiones firmadas, conteo §6, bloqueo al agotar, botón de WhatsApp, ajustes de paquetes/precios, aplicar recargas, historial y estadísticas básicas. | Agotar una tarjeta de prueba a propósito: se bloquea, el WhatsApp trae el mensaje correcto y la recarga la revive al instante. |
| **M4 — Kit de imprenta y pulido** | Descarga de QR PNG/SVG, instrucciones de reverso, página comercial `/`, textos finales, pruebas en dispositivos reales. | Pack de prueba impreso y escaneado por 3 personas distintas sin ayuda. |
| **M5 — Despliegue** | Dominio propio + HTTPS + proceso siempre activo + copias de seguridad. | La experiencia funciona desde la calle, con datos móviles, en un dominio definitivo. |

---

## 12. Decisiones abiertas (a definir por Lyam antes o durante el M1)

1. **Nombre comercial** del producto (la spec usa «Tarjetas Mágicas» como nombre de trabajo).
2. **Dominio** definitivo y hosting (debe ser estable y siempre activo).
3. **Número de WhatsApp** del negocio y **precios** de los paquetes 50/100/200 y del pack impreso/digital.
4. **Cupo incluido** por defecto en cada venta y si el pack impreso y el digital incluyen cupos distintos.
5. Quién imprime las tarjetas (imprenta local aliada vs. el cliente) y en qué material/tamaño estándar se ofrece (sugerencia: 9×5,5 cm o 10×7 cm, laminado mate — el brillo produce reflejos que dificultan el reconocimiento).
6. Si la vigencia de 12 meses se comunica como condición de venta desde el inicio (recomendado: sí, por escrito en la cotización).

---

## 13. Relación con el código actual de este repo

- `cr7/index.html` y `messi/index.html` son el **prototipo probado** del comportamiento AR: detección → reproducir desde el inicio → pausa al perder el marcador. La plantilla de la experiencia (`src/views/experience.html`) nace de ahí, parametrizando: URL del marcador, URL del video, proporción del plano y textos.
- Los videos e imágenes de los demos **no** se reutilizan comercialmente (contienen material de terceros); son solo referencia técnica.
- Este documento se mantiene vivo: cada decisión de §12 que se tome se anota aquí con su fecha.
