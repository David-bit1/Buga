const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const bucket = process.env.R2_BUCKET;
const endpoint = process.env.R2_ENDPOINT || process.env.R2_URL;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const publicUrlBase = process.env.R2_PUBLIC_URL || endpoint;
const region = process.env.R2_REGION || 'auto';

const s3Client = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey
  },
  forcePathStyle: true
});

const normalizeKey = (key) =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const buildPublicUrl = (key) => {
  const base = String(publicUrlBase || endpoint || '').replace(/\/+$/, '');
  const normalizedKey = normalizeKey(key);

  if (process.env.R2_PUBLIC_URL) {
    return `${base}/${normalizedKey}`;
  }

  return `${base}/${bucket}/${normalizedKey}`;
};

const uploadFile = async ({ key, body, contentType }) => {
  if (!key || !body || !contentType) {
    throw new Error('Key, body y contentType son obligatorios para subir un archivo a R2');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  });

  await s3Client.send(command);
  return buildPublicUrl(key);
};

const deleteFile = async (key) => {
  if (!key) {
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.warn(`No se pudo eliminar el archivo R2 ${key}:`, error.message);
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  buildPublicUrl,
  bucket
};
