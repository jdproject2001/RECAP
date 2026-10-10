import { Request, Response } from 'express';
import { generateDownloadUrl, uploadToR2 } from '../services/r2Services';

export const testR2 = async (
  req: Request,
  res: Response
): Promise<void> => {

  try {
    const key = `test/r2-test-${Date.now()}.txt`;

    const content = Buffer.from(
      'Hola desde RECAP. Esta es una prueba de Cloudflare R2.'
    );

    await uploadToR2(
      key,
      content,
      'text/plain'
    );

    const signedUrl = await generateDownloadUrl(
      key,
      300
    );

    res.json({
      success: true,
      message: 'Archivo subido correctamente a R2',
      key,
      signedUrl,
      expiresIn: 300
    });

  } catch (error) {

    console.error('Error probando R2:', error);

    res.status(500).json({
      success: false,
      error: 'Error al probar Cloudflare R2',
      details: error instanceof Error
        ? error.message
        : error
    });
  }
};