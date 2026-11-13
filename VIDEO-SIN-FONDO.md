# Video sin fondo (transparencia) en Tarjetas Mágicas

Con este modo, en vez del rectángulo de video, la persona u objeto aparece
**recortado** sobre la tarjeta, como si estuviera parado encima de la foto.
Es el mismo archivo MP4 de siempre, pero «empaquetado» de una forma especial
para que la transparencia funcione **igual en iPhone y en Android** (los
formatos con alfa nativo —WebM o HEVC— solo funcionan en una de las dos
plataformas, por eso no se usan).

## El formato empaquetado

El video final es un MP4 común y corriente con el **doble de alto**:

- **Mitad superior:** el video a color, ya sin fondo (fondo negro).
- **Mitad inferior:** la silueta en blanco y negro (blanco = visible,
  negro = transparente). Es la «máscara».

Ejemplo: contenido de 1080×960 → archivo empaquetado de 1080×1920.

Al crear la tarjeta en el panel, en **«Tipo de video»** elige
**«Sin fondo — empaquetado»**. Nada más cambia: mismo cupo, mismo QR.

## Cómo producir el archivo

1. **Graba o consigue el video** (el saludo, la persona hablando, etc.).
2. **Quítale el fondo** con cualquiera de estas herramientas:
   - [Unscreen](https://www.unscreen.com) (en línea, el más simple)
   - [Runway](https://runwayml.com) → Background Removal
   - CapCut (función «Eliminar fondo»)
   - After Effects / Premiere (rotoscopia o Keylight si fue pantalla verde)
3. **Empaqueta** las dos mitades (color arriba, máscara abajo):
   - En **After Effects**: compone el clip a color sobre la mitad superior
     de una composición de doble alto y su canal alfa (en blanco y negro)
     sobre la mitad inferior; exporta en H.264 (MP4).
   - Con **ffmpeg** (si partes de un WebM con alfa, como el de Unscreen):

     ```bash
     ffmpeg -i entrada.webm -filter_complex "[0:v]split[a][b];[a]format=yuv420p[color];[b]alphaextract,format=gray[mask];[color][mask]vstack=inputs=2,format=yuv420p" -c:v libx264 -crf 20 -preset medium -c:a aac -shortest salida-sin-fondo.mp4
     ```

## Reglas del archivo (las mismas de siempre)

- Máximo **90 segundos** y **25 MB** (el panel lo valida).
- Resolución recomendada del **contenido**: hasta 720p (el archivo
  empaquetado llegará entonces a 1440 px de alto): carga rápido en el
  celular y se ve nítido.
- Deja un pequeño margen: que la persona no toque los bordes de la mitad
  de color, para que el recorte no se vea cortado.

## Qué ve el invitado

- **En AR:** la figura recortada sobre la tarjeta, sin rectángulo.
- **En el respaldo 2D** (si el AR no está disponible): se muestra la mitad
  de color a pantalla completa, sin transparencia, como un video normal.
- El póster de la bienvenida se genera solo desde la mitad de color.
