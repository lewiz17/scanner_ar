# Tipos de contenido de una tarjeta

Al crear o editar una tarjeta, el panel ofrece **«Tipo de contenido»**:

## 1. Video (el de siempre)
Un video que se reproduce sobre el frente. Puede ser normal o
**sin fondo empaquetado** (ver `VIDEO-SIN-FONDO.md`).

## 2. Multicapas (imágenes con profundidad)
Subes de **2 a 4 imágenes con transparencia (PNG)**, en orden de atrás
hacia adelante — por ejemplo: fondo, personaje, texto/frente — y a cada
una le das una **profundidad de 0 a 10**:

- **0** = pegada a la tarjeta.
- **10** = la que más «flota» hacia el invitado.

Al mover el celular, las capas se desplazan a ritmos distintos y la foto
parece tener volumen (efecto 2.5D / paralaje). Claves para que se vea bien:

- Todas las capas deben tener **exactamente el mismo tamaño y
  proporción** que la imagen del frente (son recortes de esa misma
  composición, exportados por separado con el resto transparente).
- Exporta desde Photoshop, Photopea, Figma o Canva: oculta las demás
  capas y exporta cada una en PNG **a lienzo completo** (no recortes la
  imagen al contenido: el lienzo debe ser el de la tarjeta entera).
- Si el invitado no puede usar la cámara, el respaldo 2D muestra las
  capas superpuestas, como la composición original.

## 3. Modelo 3D (.glb)
Subes un modelo en formato **.glb** (un solo archivo, máx. **15 MB**;
ideal menos de 10 MB y pocos polígonos para que cargue rápido en el
celular) y aparece anclado sobre la tarjeta:

- **Escala:** relativa al ancho de la tarjeta (1 = ocupa todo el ancho).
  Ajusta hasta que se vea bien: cada modelo trae su propio tamaño base.
- **Rotación:** gira el modelo sobre su eje (0–359°) para que «mire»
  hacia donde quieras.
- **Orientación:** «De pie sobre la tarjeta» (el modelo se levanta hacia
  el invitado, como una figurita parada en la foto) o «Plano» (acostado
  sobre la imagen, como parte de ella).
- Si el .glb trae **animación**, se reproduce en bucle automáticamente.
- Dónde conseguir modelos: Sketchfab (filtrar por «Downloadable» y
  licencia libre), Poly Pizza, Quaternius, o encargar/modelar en
  Blender y exportar como glTF binario (.glb). Revisa la licencia si lo
  vas a vender.
- El respaldo sin cámara muestra el frente de la tarjeta e invita a
  activar la cámara (un modelo 3D no se puede «aplanar» en 2D).

En los tres tipos, la vista se cuenta con la misma regla: el contenido
debe exhibirse sobre la tarjeta detectada de forma estable (o en el
respaldo 2D), una por sesión, con deduplicación por dispositivo. Cupos,
QR y recargas funcionan igual.
