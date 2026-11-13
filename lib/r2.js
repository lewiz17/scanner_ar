'use strict';

// Cloudflare R2 vía SDK de S3: URLs firmadas de subida (panel → R2 directo)
// y de descarga (invitado ← R2, tras verificar cupo en la app).

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

let _client = null;

function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function getClient() {
  if (!_client) {
    if (!isR2Configured()) {
      throw new Error('Faltan variables de entorno de R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
    }
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

function bucket() {
  return process.env.R2_BUCKET;
}

// Clave definitiva de cada archivo de una tarjeta: cards/<cardId>/<kind>.<ext>
const KIND_EXTENSIONS = {
  image: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  video: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' },
  poster: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  marker: { 'application/octet-stream': 'mind', '': 'mind' },
  layer0: { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' },
  layer1: { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' },
  layer2: { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' },
  layer3: { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' },
  model: { 'model/gltf-binary': 'glb', 'application/octet-stream': 'glb', '': 'glb' },
};

function buildKey(cardId, kind, contentType) {
  const byKind = KIND_EXTENSIONS[kind];
  if (!byKind) return null;
  const ext = byKind[contentType] || byKind[''];
  if (!ext) return null;
  return `cards/${cardId}/${kind}.${ext}`;
}

async function presignPut(key, contentType, expiresInSeconds = 900) {
  const url = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    }),
    { expiresIn: expiresInSeconds },
  );
  return url;
}

// Por defecto 60 s (§6.3): la ventana de validez debe ser corta.
async function presignGet(key, expiresInSeconds = 60) {
  const url = await getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: expiresInSeconds },
  );
  return url;
}

async function deleteObject(key) {
  if (!key || !isR2Configured()) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

module.exports = {
  isR2Configured,
  buildKey,
  presignPut,
  presignGet,
  deleteObject,
};
