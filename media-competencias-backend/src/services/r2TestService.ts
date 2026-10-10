import { PutObjectCommand } from '@aws-sdk/client-s3';
import {
  r2Client,
  R2_BUCKET_NAME,
} from '../config/r2';

export const testR2Connection = async (): Promise<void> => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: 'test/conexion.txt',
      Body: 'R2 conectado correctamente',
      ContentType: 'text/plain',
    })
  );

  console.log('✅ Conexión con Cloudflare R2 exitosa');
};