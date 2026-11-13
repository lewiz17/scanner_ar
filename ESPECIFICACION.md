# Tarjetas Mágicas — Especificación del producto y de la plataforma

> Estado: especificación v1.1 para construir el MVP.
> Base técnica actual: las experiencias demo de este repo (`cr7/`, `messi/`) hechas con MindAR + A-Frame.
> Objetivo: convertir ese demo en una plataforma Node.js que produzca tarjetas físicas con realidad aumentada, vendibles por redes sociales para eventos.
> **Hosting (decisión 2026-11-13):** todo corre en **Vercel** (app y funciones serverless, plan Hobby), con los datos en **Neon** (Postgres) y los archivos (imagen, video, marcador, póster) en **Cloudflare R2**, cuyo ancho de banda de salida es gratuito. Ver §8 y el registro de decisiones en §12.

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
3. Validación del video al subirlo (duración/tamaño/resolución) con compresión opcional en el navegador del admin, y generación del póster (imagen de portada del video) también en el navegador. En Vercel no hay procesamiento de video del lado del servidor (§8.1).
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
   c. **Valida el video** (duración/tamaño/resolución, §7.2) y extrae el **póster** (primer frame nítido) — ambos en el navegador del admin, antes de subir los archivos a R2.
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

- El sistema **no entrega** el `.mind` ni el video si la tarjeta no está `activa` o su cupo es 0: los archivos viven en un bucket **privado** de Cloudflare R2 y solo se accede a ellos mediante endpoints de la app que verifican estado y cupo y responden con una redirección (302) a una **URL firmada de R2 que expira en ~60 segundos**. El video y el marcador nunca tienen URL pública permanente. (La ventana de validez es corta a propósito: si alguien comparte el enlace firmado, muere en segundos; el conteo de vistas ocurre por sesión, §6.2, no por descarga del archivo.)
- El decremento del cupo es **atómico** en Neon (una sola sentencia `UPDATE ... WHERE quota_total - views_used > 0 ... RETURNING`), para que dos invitados simultáneos no puedan gastar la misma última vista dos veces.
- Si el conteo falla por red justo al reproducir, el video no se bloquea a mitad de reproducción: el conteo es optimista en el cliente y autoritativo en el servidor en el siguiente acceso.

---

## 7. Requisitos de los archivos que sube el cliente

### 7.1 Imagen (frente de la tarjeta y marcador)

- Formatos: JPG o PNG. Tamaño máximo: 10 MB. Resolución recomendada: ≥ 1200 px en su lado menor.
- Debe tener **detalle y contraste** (fotos con zonas planas o muy oscuras se reconocen mal). El sistema avisa si la calidad del marcador compilado es baja (§4.2 paso 4b), pero la decisión final es del admin.
- Proporción libre; la experiencia ajusta el plano de video a la proporción real de la imagen (el demo actual usa 1×2 fijo: eso se parametriza por tarjeta).

### 7.2 Video (o animación)

- Formatos de entrada: MP4, WebM o MOV. En Vercel **no hay transcodificación del lado del servidor** (sin ffmpeg), así que el archivo se sirve tal como se subió, desde R2: el panel **valida** antes de aceptar (máx. **90 s**, máx. **25 MB**, y avisa si supera **720p** u **8 MB**: el objetivo sigue siendo que cargue en el wifi de un salón de eventos) y ofrece **compresión en el propio navegador del admin** como paso opcional previo a la subida.
- Duración recomendada: 15–60 s. Máximo aceptado: 90 s.
- Orientación: se recomienda que coincida con la de la imagen (si la foto es vertical, video vertical) para que el encaje se vea natural.
- Audio: se conserva. En móvil arranca tras el gesto de «Activar cámara»; si el navegador lo bloquea, arranca silenciado con botón de sonido visible.

---

## 8. Arquitectura técnica propuesta (MVP)

### 8.1 Stack (arquitectura serverless en Vercel)

Todo el sistema está pensado para **Vercel**: sin servidor permanente, sin disco local y sin binarios del sistema. Cada pieza vive en el servicio que mejor la resuelve:

- **App y API en Vercel (plan Hobby):** funciones serverless de Node.js (endpoints `/api/...`) + páginas estáticas servidas por el CDN de Vercel. El proyecto sigue siendo Node.js; lo que cambia es que cada petición la atiende una función efímera, no un proceso Express siempre encendido.
- **Base de datos en Neon (Postgres serverless):** tarjetas, vistas, recargas y ajustes. Se accede con el driver serverless de Neon (HTTP), pensado para funciones sin estado: sin pool de conexiones que gestionar. Las credenciales van en variables de entorno de Vercel (`DATABASE_URL`).
- **Archivos en Cloudflare R2 (bucket privado):** imagen original, `.mind`, video y póster de cada tarjeta. Motivos: la salida de datos (egress) de R2 es **gratuita** — el video es ~99 % del ancho de banda del producto y así **no consume la cuota de transferencia de Vercel** (100 GB/mes en Hobby) — y las URLs firmadas permiten el control de cupo de §6.3. Las subidas del admin van **directas del navegador a R2** con URLs firmadas de subida (las funciones de Vercel limitan el cuerpo de cada petición a ~4,5 MB; el video nunca pasa por la función).
- **Sin ffmpeg ni procesamiento pesado en el servidor:** la compresión opcional de video, la extracción del póster y la compilación del marcador ocurren en el **navegador del admin** (§7.2 y §8.3).
- **Frontend**: HTML/CSS/JS sin framework, como el panel de Aurora. La experiencia usa **MindAR 1.2.2 + A-Frame 1.4.2** servidos desde el propio despliegue (no desde CDN público, para no depender de terceros el día del evento).
- **QR**: generado en el panel con la librería `qrcode` en el navegador (PNG/SVG descargables al momento), sin pasar por el servidor.
- **Dominio y DNS en Cloudflare** (§8.6): el dominio se registra y gestiona fuera de Vercel, apuntando a Vercel por DNS. Así, si algún día la app se mueve de proveedor, se reapunta el DNS y **los QR impresos siguen vivos**.

### 8.2 Rutas principales

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Público | Página comercial simple del negocio (qué es, ejemplos, botón de WhatsApp). |
| `/v/<slug>` | Invitados | La experiencia. Página generada por tarjeta (plantilla única) desde una función que lee Neon. |
| `/api/v/<slug>/asset?kind=marker\|video\|poster` | Invitados | Verifica estado y cupo en Neon y redirige (302) a la **URL firmada de R2** (expira ~60 s). R2 sirve los bytes con soporte de `Range`. |
| `/api/v/<slug>/session` | Invitados | Crea la sesión firmada de experiencia y devuelve el estado (activa/agotada/pausada). |
| `/api/v/<slug>/view` | Invitados | Registra la vista (token de sesión; aplica §6) y descuenta el cupo en Neon de forma atómica. |
| `/admin` | Admin | Panel (login, tarjetas, ajustes, estadísticas). |
| `/api/admin/...` | Admin | CRUD de tarjetas (Neon), emisión de URLs firmadas de **subida** a R2, recargas, ajustes. |

### 8.3 Compilación automática del marcador (decisión cerrada)

El cliente **nunca** sube un `.mind`: solo imagen y video. En la arquitectura Vercel la compilación en el servidor no es viable (funciones efímeras, con límites de tiempo y memoria, y el compilador de MindAR es pesado), así que la decisión está tomada:

- **El marcador se compila en el navegador del admin**, con el compilador web oficial de MindAR, mientras el admin rellena el formulario de la tarjeta. Al guardar, el panel sube a R2 la imagen, el video, el póster y el `.mind` ya compilado. Para el admin el flujo sigue siendo «subir imagen y video»: la compilación es automática e invisible.
- Se guarda también la **imagen original** (la que se imprime) y la métrica de calidad del marcador para el aviso de §4.2.
- El hito M0 (§11) valida este flujo de punta a punta en un celular real antes de construir el resto.

### 8.4 Modelo de datos (Neon / Postgres)

**`cards`** — una fila por tarjeta:

| Campo | Notas |
|---|---|
| `id`, `slug` (único) | slug público no adivinable |
| `title`, `client_name`, `event_type`, `event_date`, `notes` | datos de gestión |
| `image_key`, `marker_key`, `video_key`, `poster_key` | claves de los objetos en el bucket de R2 |
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
├── vercel.json             # rutas: /v/<slug> y /admin servidos por funciones/páginas
├── api/
│   ├── v/[slug]/           # funciones públicas: página, asset (302 a R2), session, view
│   └── admin/              # funciones del panel: tarjetas, uploads firmados, recargas, ajustes
├── lib/
│   ├── db.js               # acceso a Neon (driver serverless)
│   ├── cards.js            # lógica de tarjetas y cupo (§6)
│   ├── r2.js               # URLs firmadas de subida/descarga (SDK S3)
│   └── auth.js             # sesión del admin
├── public/
│   ├── experience.html     # plantilla de la experiencia (MindAR + A-Frame, assets locales)
│   └── admin.html          # panel (un solo archivo; compila el .mind y genera el QR en el navegador)
└── tests/
```

Fuera del repo (configuración, no código): base de datos en **Neon**, bucket privado en **Cloudflare R2** (con CORS que permita las subidas desde el dominio del panel y las descargas firmadas), variables de entorno en **Vercel** (`DATABASE_URL`, credenciales R2, secreto de sesión).

### 8.6 Despliegue

- **Vercel** despliega la app desde este repo (funciones + estáticos), con **HTTPS automático** — sin HTTPS ningún navegador da acceso a la cámara.
- Requisito duro: el dominio debe ser **estable** — los QR impresos apuntan a él para siempre. Por eso el dominio se **registra en Cloudflare Registrar (o se transfiere ahí) y el DNS se gestiona en Cloudflare**, apuntando a Vercel: el activo permanente es el dominio, no el proveedor de hosting. Si Vercel fallara o hubiera que migrar (a Pro, o a Cloudflare Pages/Workers), se reapunta el DNS y las tarjetas en la calle no se enteran.
- Datos en **Neon** y archivos en **R2**: ambos son independientes de Vercel, así que una migración de la app no toca ni las tarjetas ni su historial.
- Copias de seguridad: export periódico de Neon (o su point-in-time propio) y versionado/segunda copia del bucket R2 para los archivos originales.

---

## 9. Requisitos no funcionales

- **Rendimiento:** la experiencia debe mostrar la cámara en ≤ 3 s en 4G con el video ya en búfer progresivo; peso total inicial de la página (sin video) ≤ 1,5 MB. MindAR/A-Frame se sirven localmente y con caché larga (son inmutables por versión).
- **Compatibilidad:** Safari iOS 16+ y Chrome Android recientes como objetivo principal (es el parque real de los invitados). Probar también Samsung Internet y navegadores in-app de Instagram/WhatsApp, con el respaldo 2D (§4.3 paso 6) como red de seguridad.
- **Seguridad:** panel tras login con sesiones seguras; subida de archivos validada por tipo real (no solo extensión) y con límites de tamaño; slugs no secuenciales; endpoints de conteo con rate-limit; cabeceras `Cache-Control` que eviten que el video/marcador queden en cachés públicas.
- **Privacidad:** no se recogen datos personales de los invitados. Solo conteos agregados y clase de dispositivo. Sin cookies de terceros en la experiencia.
- **Disponibilidad:** es un producto de «momento único» (el día del evento): la arquitectura serverless no se duerme (no hay arranque en frío de minutos como en los planes gratuitos con spin-down), y cada pieza (Vercel, Neon, R2) tiene disponibilidad independiente.
- **Presupuesto de ancho de banda (plan Hobby):** la transferencia de Vercel (100 GB/mes incluidos en Hobby) cubre solo HTML, la plantilla y las llamadas a funciones, porque **los medios se sirven desde R2, cuya salida es gratuita**. Regla de oro de la implementación: ningún byte de video/marcador/póster puede pasar por una función de Vercel. Las invocaciones de funciones en Hobby (1 M/mes) son de sobra para sesiones y conteos.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación (ya incluida en esta spec) |
|---|---|
| Foto con poco detalle → el AR no la reconoce en el evento | Métrica de calidad al crear (§4.2) + aviso al admin + recomendación de imágenes con contraste; probar siempre con la tarjeta **impresa** antes de entregar el pack. |
| La imprenta recorta o altera la imagen → el marcador deja de coincidir | Kit de imprenta con la imagen exacta (§5.5) e instrucción de imprimir sin recorte ni filtros; incluir márgenes de seguridad en el diseño. |
| Wifi del salón lento → el video tarda | Compresión agresiva (§7.2), póster inmediato, carga progresiva y mensaje «cargando…» amable. |
| iOS bloquea audio/cámara | Botón «Activar cámara» como gesto inicial (§4.3), video que arranca silenciado si hace falta y botón de sonido. |
| Un invitado (o un bot) quema el cupo refrescando | Definición de vista (§6.1) + token de sesión + deduplicación por dispositivo (§6.2). |
| Se cae una pieza el día del evento | Vercel, Neon y R2 son servicios gestionados e independientes entre sí; la disponibilidad sigue siendo **el** requisito crítico (del respaldo 2D también depende la misma cadena), y por eso el dominio vive en Cloudflare (§8.6): si la app hubiera que moverla de proveedor, el DNS se reapunta y los QR sobreviven. |
| **Vercel Hobby es, según sus normas de uso justo, solo para proyectos personales no comerciales** | Decisión del dueño (2026-11-13, §12): arrancar en Hobby aun vendiendo tarjetas, **asumiendo el riesgo** de que Vercel pueda pausar el despliegue por uso comercial. La arquitectura está diseñada para que ese golpe no sea fatal: datos en Neon, archivos en R2 y dominio en Cloudflare — migrar la app a Vercel Pro o a otro proveedor no toca tarjetas, cupos ni QR impresos. Revisar esta decisión al primer aviso de Vercel o cuando el volumen lo justifique. |
| Cambiar de dominio/hosting con tarjetas ya impresas | Dominio propio estable desde el inicio (§8.6); los slugs no cambian nunca. |

---

## 11. Plan de construcción (hitos verificables)

| Hito | Contenido | Criterio de aceptación |
|---|---|---|
| **M0 — Spike técnico** | Validar el flujo serverless completo en miniatura: el panel compila el `.mind` en el navegador, sube imagen/video/marcador a R2 con URL firmada, la experiencia lo lee vía redirección firmada tras verificar Neon, y una vista de prueba descuenta el cupo atómicamente. | Con una imagen de prueba, el AR funciona en un celular real servido desde Vercel + R2, y el contador de Neon baja de 1 en 1 sin duplicarse al refrescar. |
| **M1 — Núcleo** | Proyecto Vercel + Neon + R2 conectados; login admin; CRUD de tarjetas con subida directa a R2, compilación del marcador y póster en el navegador. | Crear una tarjeta completa desde el panel sin tocar archivos a mano. |
| **M2 — Experiencia** | Plantilla `/v/<slug>` con bienvenida, AR, respaldo 2D y controles; activos servidos con verificación de estado/cupo. | Con una tarjeta impresa de prueba, un invitado completa el flujo en iOS y Android. |
| **M3 — Cupo y recargas** | Sesiones firmadas, conteo §6, bloqueo al agotar, botón de WhatsApp, ajustes de paquetes/precios, aplicar recargas, historial y estadísticas básicas. | Agotar una tarjeta de prueba a propósito: se bloquea, el WhatsApp trae el mensaje correcto y la recarga la revive al instante. |
| **M4 — Kit de imprenta y pulido** | Descarga de QR PNG/SVG, instrucciones de reverso, página comercial `/`, textos finales, pruebas en dispositivos reales. | Pack de prueba impreso y escaneado por 3 personas distintas sin ayuda. |
| **M5 — Despliegue** | Dominio propio registrado en Cloudflare apuntando a Vercel + HTTPS + variables de entorno + copias de seguridad de Neon y R2. | La experiencia funciona desde la calle, con datos móviles, en un dominio definitivo. |

---

## 12. Decisiones

### Tomadas

- **2026-11-13 — Primero la especificación, después el código.** Se escribe y aprueba este documento antes de construir.
- **2026-11-13 — Hosting: todo en Vercel, datos en Neon, medios en Cloudflare R2** (§8). La app y las funciones corren en Vercel; Neon guarda tarjetas/vistas/recargas/ajustes; R2 guarda imagen/video/marcador/póster porque su ancho de banda de salida es gratuito y así el video no consume la cuota de transferencia de Vercel.
- **2026-11-13 — Plan de Vercel: Hobby (gratuito), aun ofreciendo tarjetas a la venta.** Decisión del dueño con el riesgo explícito de §10: las normas de Vercel reservan Hobby para uso no comercial y el despliegue podría ser pausado; la arquitectura desacoplada (Neon + R2 + dominio en Cloudflare) es la mitigación acordada.
- **2026-11-13 — El marcador se compila en el navegador del admin** (§8.3); no hay compilación ni ffmpeg en el servidor.

### Abiertas (a definir por Lyam antes o durante el M1)

1. **Nombre comercial** del producto (la spec usa «Tarjetas Mágicas» como nombre de trabajo).
2. **Nombre de dominio** definitivo (el registro y el DNS ya está decidido que vivan en Cloudflare, §8.6; falta elegir el nombre).
3. **Número de WhatsApp** del negocio y **precios** de los paquetes 50/100/200 y del pack impreso/digital.
4. **Cupo incluido** por defecto en cada venta y si el pack impreso y el digital incluyen cupos distintos.
5. Quién imprime las tarjetas (imprenta local aliada vs. el cliente) y en qué material/tamaño estándar se ofrece (sugerencia: 9×5,5 cm o 10×7 cm, laminado mate — el brillo produce reflejos que dificultan el reconocimiento).
6. Si la vigencia de 12 meses se comunica como condición de venta desde el inicio (recomendado: sí, por escrito en la cotización).

---

## 13. Relación con el código actual de este repo

- `cr7/index.html` y `messi/index.html` son el **prototipo probado** del comportamiento AR: detección → reproducir desde el inicio → pausa al perder el marcador. La plantilla de la experiencia (`src/views/experience.html`) nace de ahí, parametrizando: URL del marcador, URL del video, proporción del plano y textos.
- Los videos e imágenes de los demos **no** se reutilizan comercialmente (contienen material de terceros); son solo referencia técnica.
- Este documento se mantiene vivo: cada decisión de §12 que se tome se anota aquí con su fecha.
