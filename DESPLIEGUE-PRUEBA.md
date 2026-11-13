# Tarjetas Mágicas — Guía de la PRIMERA PRUEBA

Esta guía es para desplegar la plataforma por primera vez y probar el
flujo completo desde el panel: crear una tarjeta, escanear su QR con el
celular, ver el contador de vistas bajar y agotar el cupo a propósito
para ver la pantalla de recarga por WhatsApp.

No necesitas saber programar: todo es copiar y pegar en tres servicios
(Neon, Cloudflare y Vercel). Tiempo estimado: **30–45 minutos**.

> Antes de empezar: el código ya está en GitHub, en la rama
> **`plataforma-mvp`** del repo `scanner_ar`. En esta primera prueba la
> app vivirá en un dominio `*.vercel.app` (perfecto para probar; el
> dominio propio definitivo se configura después, antes de imprimir
> tarjetas de verdad).

---

## Paso 1 — Neon: crear la base de datos

1. Entra a [neon.tech](https://neon.tech) y crea una cuenta (puedes
   entrar con GitHub).
2. Crea un proyecto: **New Project** → nombre: `tarjetas-magicas` →
   **Create project**.
3. Al terminar, Neon muestra un **connection string** parecido a:

   ```
   postgresql://neondb_owner:npg_xxxxxx@ep-nombre-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

4. Cópialo y guárdalo en un bloc de notas: es tu **`DATABASE_URL`**.
   No lo compartas con nadie: es la llave de tu base de datos.

## Paso 2 — Cloudflare R2: crear el almacén de archivos

Aquí vivirán la imagen, el video, el marcador y el póster de cada
tarjeta. La salida de datos de R2 es gratuita: por eso los videos no
consumen el ancho de banda de Vercel.

1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) y crea tu
   cuenta si aún no tienes una.
2. En el menú lateral entra a **R2 Object Storage** y actívalo.
   ⚠️ Cloudflare puede pedirte **registrar un método de pago** para
   activar R2 aunque uses el nivel gratuito (incluye 10 GB de
   almacenamiento gratis; los videos de este proyecto pesan pocos MB).
3. **Create bucket** → nombre exacto: `tarjetas-magicas` → **Create**.
   No actives ninguna opción de acceso público ni «r2.dev»: el bucket
   debe quedar **privado**.
4. Crea el token de acceso: en la portada de R2 pulsa
   **Manage R2 API Tokens** (o «{ } API» → Manage API Tokens) →
   **Create API token**:
   - Nombre: `tarjetas-magicas-app`
   - Permissions: **Object Read & Write**
   - Bucket: limita el token al bucket `tarjetas-magicas` si te da la
     opción.
   - **Create** → Cloudflare muestra tres datos:
     - **Access Key ID**
     - **Secret Access Key** ← se muestra **una sola vez**: cópiala ya.
   - En la misma pantalla de R2 anota también el **Account ID** de tu
     cuenta (está en la columna derecha de la portada de R2).
5. Guarda estos cuatro valores en tu bloc de notas:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET=tarjetas-magicas`.

### 2.1 — CORS del bucket (importante, no lo saltes)

Sin esto, el navegador no podrá subir los archivos ni reproducir el
video sobre la tarjeta.

1. En Cloudflare entra al bucket `tarjetas-magicas` →
   **Settings** → **CORS Policy** → **Edit/Add**.
2. Pega este JSON tal cual (en el Paso 4 cambiarás la dirección de
   ejemplo por la tuya real):

```json
[
  {
    "AllowedOrigins": ["https://TU-PROYECTO.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Guarda. Cuando conozcas tu dominio real de Vercel (siguiente paso),
   vuelve aquí y reemplaza `TU-PROYECTO.vercel.app` por ese dominio.

## Paso 3 — Generar dos secretos

En tu computador abre una terminal y ejecuta dos veces:

```bash
openssl rand -hex 32
```

- El primer resultado será tu **`SESSION_SECRET`**.
- El segundo será tu **`SETUP_SECRET`** (debe ser distinto).

Si no tienes terminal a mano, usa el generador de contraseñas de tu
gestor de contraseñas: una cadena aleatoria de al menos 40 caracteres.

Además decide ahora:
- **`ADMIN_USER`**: `admin` está bien.
- **`ADMIN_PASSWORD`**: una contraseña fuerte para entrar al panel.
  Guárdala en tu gestor de contraseñas.

## Paso 4 — Vercel: importar el proyecto

1. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New… → Project** → en la lista de repos elige
   **`scanner_ar`** → **Import**.
   (Si no aparece, pulsa «Adjust GitHub App Permissions» y dale acceso
   al repo.)
3. Antes de desplegar, abre **Environment Variables** y agrega **todas**
   estas variables (una por una, nombre y valor):

   | Variable | Qué poner |
   |---|---|
   | `DATABASE_URL` | El connection string de Neon del Paso 1 |
   | `R2_ACCOUNT_ID` | El Account ID de Cloudflare del Paso 2 |
   | `R2_ACCESS_KEY_ID` | El Access Key ID del token de R2 |
   | `R2_SECRET_ACCESS_KEY` | El Secret Access Key del token de R2 |
   | `R2_BUCKET` | `tarjetas-magicas` |
   | `SESSION_SECRET` | El primer secreto del Paso 3 |
   | `SETUP_SECRET` | El segundo secreto del Paso 3 |
   | `ADMIN_USER` | `admin` |
   | `ADMIN_PASSWORD` | Tu contraseña del panel |
   | `PUBLIC_BASE_URL` | Déjala **sin crear** por ahora (opcional) |

4. En **Framework Preset** elige **Other**. No hay comando de build que
   configurar.
5. Pulsa **Deploy** y espera a que termine (1–2 minutos).
6. Al terminar, Vercel te muestra tu dominio, algo como
   `https://scanner-ar-xxxx.vercel.app`. **Anótalo.**
7. **Apunta la rama de la prueba:** entra a tu proyecto en Vercel →
   **Settings → Environments → Production → Branch Tracking** → escribe
   **`plataforma-mvp`** → Save. (Ojo: ya no está en Settings → Git; Vercel
   lo movió a Environments.) Luego ve a **Deployments**, abre el
   despliegue más reciente de la rama `plataforma-mvp` y en su menú **⋯**
   pulsa **Promote to Production**. (Cuando la plataforma esté probada,
   esta rama se unirá a `main` y este paso dejará de hacer falta.)
8. **Vuelve al Paso 2.1** y actualiza el CORS del bucket con tu dominio
   real de Vercel.

## Paso 5 — Inicializar la base de datos (una sola vez)

1. Abre `https://TU-DOMINIO.vercel.app/admin` en tu navegador.
2. Verás un aviso amarillo: «La base de datos aún no está
   inicializada». Pulsa **Inicializar base de datos**.
3. Escribe tu **`SETUP_SECRET`** cuando el navegador lo pida y acepta.
   Debe decir: «Base de datos inicializada».
4. Entra con tu **`ADMIN_USER`** y **`ADMIN_PASSWORD`**.

Si el paso 3 falla, revisa en Vercel → tu proyecto → **Settings →
Environment Variables** que `DATABASE_URL` y `SETUP_SECRET` estén bien
pegados, y vuelve a intentarlo (cambiar una variable exige **Redeploy**
para que tome efecto).

## Paso 6 — Configurar tu WhatsApp (para la pantalla de recarga)

1. En el panel pulsa **Ajustes**.
2. Escribe tu **WhatsApp del negocio** con código de país, solo
   números (ej. Colombia: `573001234567`).
3. Los precios de los paquetes puedes dejarlos en 0 en esta prueba;
   el cupo por defecto déjalo en **100**.
4. **Guardar ajustes**.

## Paso 7 — Crear tu primera tarjeta de prueba

Qué necesitas:
- **Una imagen** con buen detalle y contraste (una foto tuya nítida
  sirve; evita fotos oscuras o con fondos planos).
- **Un video corto vertical** (10–20 s, que pese menos de 8 MB).

En el panel:

1. Pulsa **+ Nueva tarjeta**.
2. Título: `Prueba 1`. Cliente: tu nombre. Tipo de evento: el que
   quieras.
3. **Cupo de vistas: escribe `1`.** Sí, uno solo: es a propósito, para
   probar el agotamiento en el Paso 9.
4. Estado: **Activa**.
5. Elige la imagen y el video. Espera a que cada uno diga «listo».
6. Pulsa **Guardar tarjeta** y **no cierres la ventana**: primero verás
   «Compilando el marcador…» (puede tardar entre 10 y 60 segundos: es
   el navegador preparando el reconocimiento de tu imagen) y luego las
   subidas.
7. Cuando termine, la tarjeta aparecerá en la lista con saldo
   **0 / 1** (0 vistas usadas de 1).

## Paso 8 — Probar la experiencia con el celular

1. En la lista, pulsa **QR** en tu tarjeta y luego
   **Descargar QR (PNG)**.
2. Muestra la **imagen del frente** a pantalla completa en otra
   pantalla (tu computador sirve: abre la foto original) o, mejor,
   imprímela en una hoja.
3. Con tu celular, **escanea el QR** (con la cámara normal del
   teléfono). Se abrirá la experiencia: toca **Activar cámara** y
   acepta el permiso.
4. **Apunta la cámara a la imagen.** Al reconocerla, el video se
   reproduce encima de la foto. 🎉
   - Si tarda: busca buena luz, evita el brillo/reflejo de la pantalla
     y mantén el celular firme a unos 20–40 cm.
5. Vuelve al panel en el computador y pulsa **↻ Actualizar**: la
   tarjeta debe decir **1 / 1** y «quedan 0». Aunque reescanees el QR
   con el mismo celular enseguida, no debe contar dos veces (hay una
   protección de 10 minutos por dispositivo).

## Paso 9 — Agotar el cupo y ver la pantalla de WhatsApp

1. Con el cupo ya en 0, abre de nuevo el enlace de la tarjeta en el
   celular (reescanea el QR o refresca la página).
2. Verás la pantalla: **«Esta tarjeta ya alcanzó su límite de
   visualizaciones 💛»** con el botón verde de **WhatsApp**.
3. Tócalo: debe abrir WhatsApp con un mensaje ya escrito con el nombre
   de la tarjeta y los paquetes. (Es el mensaje que recibirías de un
   anfitrión que quiere recargar.) No hace falta enviarlo.
4. En el panel, pulsa **Recargar** en la tarjeta → elige el paquete de
   50 → **Aplicar recarga**.
5. Refresca la experiencia en el celular: la tarjeta vuelve a funcionar
   con su nuevo saldo (51 − 1 = 50 disponibles). El QR **no cambia**:
   por eso las tarjetas impresas nunca quedan obsoletas al recargar.

✅ **Prueba completa superada**: creaste una tarjeta, el AR funcionó,
el contador descontó una sola vista, el cupo se agotó con la pantalla
correcta y la recarga lo reactivó al instante.

---

## Problemas frecuentes

| Síntoma | Qué revisar |
|---|---|
| La cámara no abre o el navegador dice «sitio no seguro» | La experiencia solo funciona por **HTTPS**. Usa siempre el dominio `*.vercel.app` (o tu dominio propio con HTTPS), nunca una IP o `http://`. |
| En el celular se abre dentro de WhatsApp/Instagram y la cámara falla | Esos navegadores internos a veces bloquean la cámara. Abre el enlace en **Safari (iPhone)** o **Chrome (Android)** con «Abrir en el navegador». |
| «La base de datos aún no está inicializada» no desaparece | Ejecuta el Paso 5. Si el error menciona `DATABASE_URL`, la variable está mal pegada: cópiala de nuevo desde Neon y haz **Redeploy** en Vercel. |
| Al guardar la tarjeta, la subida falla | Casi siempre es el **CORS del bucket** (Paso 2.1): el dominio debe ser **exactamente** el tuyo de Vercel, con `https://` y sin barra final. También revisa que el token de R2 sea **Object Read & Write** y que el nombre del bucket sea `tarjetas-magicas`. |
| El marcador «Compilando…» no termina | Recarga la página del panel y vuelve a intentarlo. Si la imagen es enorme (>10 MB), redúcela primero. El compilador corre en tu navegador: usa Chrome/Edge en el computador para este paso. |
| La cámara no reconoce la imagen | Más luz, menos reflejos (las pantallas brillan: imprimir en papel mate funciona mejor), imagen con más detalle/contraste, celular firme a 20–40 cm. Una imagen «de calidad baja» según el aviso del panel es mala candidata: cambia la foto. |
| El video tarda mucho en cargar | Comprímelo: máximo ~8 MB y 720p. El wifi de los salones de eventos es el peor escenario: entre más liviano, mejor. |
| La experiencia dice «cupo agotado» pero acabas de crear la tarjeta | Revisa que el cupo inicial no haya quedado en 0 y que el estado sea **Activa** en el panel. |
| Veo errores 500 en el panel | En Vercel → tu proyecto → **Deployments** → el despliegue → **Functions** puedes ver el registro de errores. Lo más común: alguna variable de entorno faltante o mal escrita. |
| Conté una vista sin querer durante las pruebas | Es normal probando. Puedes compensarla con **Editar → Ajuste manual de cupo** (queda registrado en el historial). |

---

## Qué sigue después de la prueba

- Poner precios reales a los paquetes en **Ajustes**.
- Configurar el **dominio propio** (registrado en Cloudflare) antes de
  imprimir las primeras tarjetas de verdad: el QR es para siempre.
- Unir la rama `plataforma-mvp` a `main` y dejar `main` como rama de
  producción en Vercel.
