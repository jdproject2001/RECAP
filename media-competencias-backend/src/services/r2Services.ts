import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { R2_BUCKET_NAME } from '../config/r2';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  throw new Error(
    'Faltan variables de entorno de Cloudflare R2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY o R2_BUCKET_NAME'
  );
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey }
});

/**
 * Genera una URL temporal para subir directamente desde el navegador a R2.
 */
export const generateUploadUrl = async (
  key: string,
  mimeType: string
): Promise<string> => {

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: mimeType
  });

  return await getSignedUrl(r2Client, command, {
    expiresIn: 900 // 15 minutos
  });
};

/**
 * Verifica que un archivo realmente exista en R2.
 */
export const checkObjectExists = async (
  key: string
) => {

  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  return await r2Client.send(command);
};

export { r2Client };


// Generar URL temporal para descargar
export const generateDownloadUrl = async (
  key: string,
  expiresInSeconds = 300,
  fileName?: string
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: fileName
      ? `attachment; filename="${fileName}"`
      : 'attachment'
  });

  return await getSignedUrl(r2Client, command, {
    expiresIn: expiresInSeconds
  });
};


// Eliminar archivo
export const deleteFromR2 = async (
  key: string
): Promise<void> => {

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    })
  );
};

// =====================================================
// Descargar archivo desde R2
// =====================================================

export const downloadFromR2 = async (
  key: string
): Promise<Buffer> => {

  const result = await r2Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key
    })
  );

  if (!result.Body) {
    throw new Error('R2 no devolvió contenido para el archivo.');
  }

  const bytes = await result.Body.transformToByteArray();

  return Buffer.from(bytes);
};

// =====================================================
// Subir preview a R2
// =====================================================

export const uploadPreviewToR2 = async (
  key: string,
  buffer: Buffer
): Promise<void> => {

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg'
    })
  );
};