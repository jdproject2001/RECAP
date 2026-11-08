import sharp from 'sharp';
import {
  uploadPreviewToR2,
  downloadFromR2
} from './r2Services';

export const generatePhotoPreview = async (
  originalKey: string
): Promise<string> => {

  // =====================================================
  // 1. DESCARGAR ORIGINAL
  // =====================================================

  const originalBuffer =
    await downloadFromR2(originalKey);

  // =====================================================
  // 2. REDIMENSIONAR PRIMERO
  // =====================================================

  const resizedBuffer = await sharp(originalBuffer)
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true
    })
    .toBuffer();

  // =====================================================
  // 3. OBTENER DIMENSIONES REALES DEL PREVIEW
  // =====================================================

  const metadata =
    await sharp(resizedBuffer).metadata();

  const width =
    metadata.width || 1600;

  const height =
    metadata.height || 1600;

  // =====================================================
  // 4. CONFIGURACIÓN WATERMARK
  // =====================================================

  const diagonalFontSize =
    Math.max(
      24,
      Math.round(width * 0.035)
    );

  const diagonalSpacing =
    Math.max(
      150,
      Math.round(width * 0.16)
    );

  const centerFontSize =
    Math.max(
      90,
      Math.round(width * 0.25)
    );

  const redDotRadius =
    Math.max(
      12,
      Math.round(width * 0.030)
    );

  const centerTextY =
    Math.round(height * 0.58);

  // =====================================================
  // 5. SVG DEL WATERMARK
  // =====================================================

  const watermarkSvg = `
  <svg
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>

      <!-- ========================================= -->
      <!-- PATRÓN DE TEXTO RECAP -->
      <!-- ========================================= -->

      <pattern
        id="recapPattern"
        patternUnits="userSpaceOnUse"
        width="${diagonalSpacing}"
        height="${diagonalSpacing}"
        patternTransform="rotate(-35)"
      >
        <text
          x="15"
          y="${Math.round(diagonalSpacing * 0.55)}"
          fill="white"
          fill-opacity="0.40"
          font-size="${diagonalFontSize}"
          font-family="Arial, sans-serif"
          font-weight="700"
        >
          recap.
        </text>
      </pattern>


      <!-- ========================================= -->
      <!-- LÍNEAS DIAGONALES \ -->
      <!-- ========================================= -->

      <pattern
        id="linesOne"
        patternUnits="userSpaceOnUse"
        width="220"
        height="220"
      >
        <path
          d="M -55 55 L 55 -55
             M 0 220 L 220 0
             M 165 275 L 275 165"
          stroke="white"
          stroke-opacity="0.45"
          stroke-width="4"
          fill="none"
        />
      </pattern>


      <!-- ========================================= -->
      <!-- LÍNEAS DIAGONALES / -->
      <!-- ========================================= -->

      <pattern
        id="linesTwo"
        patternUnits="userSpaceOnUse"
        width="220"
        height="220"
      >
        <path
          d="M -55 165 L 55 275
             M 0 0 L 220 220
             M 165 -55 L 275 55"
          stroke="white"
          stroke-opacity="0.22"
          stroke-width="2"
          fill="none"
        />
      </pattern>

    </defs>


    <!-- ========================================= -->
    <!-- CUADRÍCULA DIAGONAL -->
    <!-- ========================================= -->

    <rect
      width="100%"
      height="100%"
      fill="url(#linesOne)"
    />

    <rect
      width="100%"
      height="100%"
      fill="url(#linesTwo)"
    />


    <!-- ========================================= -->
    <!-- RECAP PEQUEÑO REPETIDO -->
    <!-- ========================================= -->

    <rect
      width="100%"
      height="100%"
      fill="url(#recapPattern)"
    />


    <!-- ========================================= -->
    <!-- RECAP CENTRAL GRANDE -->
    <!-- ========================================= -->

    <text
      x="50%"
      y="${centerTextY}"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="white"
      fill-opacity="0.82"
      font-size="${centerFontSize}"
      font-family="Arial, sans-serif"
      font-weight="800"
      letter-spacing="-3"
    >
      recap
    </text>


    <!-- ========================================= -->
    <!-- PUNTO ROJO -->
    <!-- ========================================= -->

    <circle
      cx="${Math.round(width * 0.79)}"
      cy="${Math.round(centerTextY + centerFontSize * 0.12)}"
      r="${redDotRadius}"
      fill="#FF0019"
      fill-opacity="0.95"
    />

  </svg>
`;

  const watermarkBuffer =
    Buffer.from(watermarkSvg);

  // =====================================================
  // 6. APLICAR WATERMARK
  // =====================================================

  const previewBuffer =
    await sharp(resizedBuffer)
      .composite([
        {
          input: watermarkBuffer,
          top: 0,
          left: 0
        }
      ])
      .jpeg({
        quality: 75
      })
      .toBuffer();

  // =====================================================
  // 7. GENERAR KEY PREVIEW
  // =====================================================

  const previewKey =
    originalKey
      .replace(
        '/original/',
        '/preview/'
      )
      .replace(
        /\.[^/.]+$/,
        '.jpg'
      );

  // =====================================================
  // 8. SUBIR PREVIEW
  // =====================================================

  await uploadPreviewToR2(
    previewKey,
    previewBuffer
  );
  

  return previewKey;
};