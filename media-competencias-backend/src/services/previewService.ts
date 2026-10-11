import sharp from 'sharp';
import { uploadPreviewToR2, downloadFromR2 } from './r2Services';

sharp.cache(false);
sharp.concurrency(1);

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

export const generatePhotoPreview = async (
  originalKey: string
): Promise<string> => {
  const previewKey = originalKey
    .replace('/original/', '/preview/')
    .replace(/\.[^/.]+$/, '.jpg');

  const originalBuffer = await downloadFromR2(originalKey);

  const previewBuffer = await sharp(originalBuffer, {
    sequentialRead: true,
    limitInputPixels: 268402689
  })
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
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
      quality: 72,
      mozjpeg: true
    })
    .toBuffer();

  await uploadPreviewToR2(previewKey, previewBuffer);

  return previewKey;
};