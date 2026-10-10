import sharp from 'sharp';
import { uploadPreviewToR2, downloadFromR2 } from './r2Services';

// =====================================================
// Generar preview de una foto
// =====================================================

export const generatePhotoPreview = async (
  originalKey: string
): Promise<string> => {

  // ---------------------------------------------
  // Descargar original desde R2
  // ---------------------------------------------

  const originalBuffer = await downloadFromR2(originalKey);

  // ---------------------------------------------
  // Crear marca de agua
  // ---------------------------------------------

  const watermarkSvg = `
    <svg width="600" height="120">
      <style>
        .watermark {
          fill: white;
          fill-opacity: 0.45;
          font-size: 64px;
          font-family: Arial, sans-serif;
          font-weight: bold;
        }
      </style>

      <text
        x="300"
        y="75"
        text-anchor="middle"
        class="watermark"
      >
        RECAP
      </text>
    </svg>
  `;

  const watermarkBuffer = Buffer.from(watermarkSvg);

  // ---------------------------------------------
  // Procesar imagen
  // ---------------------------------------------

  const previewBuffer = await sharp(originalBuffer)
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true
    })
    .composite([
      {
        input: watermarkBuffer,
        gravity: 'center'
      }
    ])
    .jpeg({
      quality: 75
    })
    .toBuffer();

  // ---------------------------------------------
  // Construir key del preview
  // ---------------------------------------------

  const previewKey = originalKey.replace(
    '/original/',
    '/preview/'
  ).replace(
    /\.[^/.]+$/,
    '.jpg'
  );

  // ---------------------------------------------
  // Subir preview
  // ---------------------------------------------

  await uploadPreviewToR2(
    previewKey,
    previewBuffer
  );

  return previewKey;
};