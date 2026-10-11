import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { query } from '../db';
import { generateUploadUrl, checkObjectExists, generateDownloadUrl } from '../services/r2Services';
import { generatePhotoPreview } from '../services/previewService';
import { ejecutarPreviewEnCola } from '../services/previewQueue';

// =====================================================
// Verificar que el usuario tenga rol técnico o admin
// =====================================================

const verificarRolMultimedia = async (
  firebaseUid: string
): Promise<boolean> => {

  const result = await query(
    `
    SELECT 1
    FROM usuarios u
    INNER JOIN usuario_roles ur
      ON ur.usuario_id = u.id
    INNER JOIN roles r
      ON r.id = ur.rol_id
    WHERE u.firebase_uid = $1
      AND r.nombre_rol IN ('admin', 'tecnico')
    LIMIT 1
    `,
    [firebaseUid]
  );

  return result.rows.length > 0;
};


// =====================================================
// 1. Generar URL de subida
// =====================================================
export const generateMultimediaUploadUrl = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {

  const {
    participanteId,
    tipo,
    nombreArchivo,
    mimeType
  } = req.body;

  // ---------------------------------------------
  // Validación de autenticación
  // ---------------------------------------------
  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  // ---------------------------------------------
  // Validación de datos
  // ---------------------------------------------
  if (!participanteId || !tipo || !nombreArchivo || !mimeType) {
    res.status(400).json({
      error: 'participanteId, tipo, nombreArchivo y mimeType son obligatorios.'
    });
    return;
  }

  if (!['foto', 'video'].includes(tipo)) {
    res.status(400).json({
      error: 'El tipo de multimedia debe ser foto o video.'
    });
    return;
  }

  // ---------------------------------------------
  // Verificar rol
  // ---------------------------------------------
  const tienePermiso = await verificarRolMultimedia(firebaseUid);

  if (!tienePermiso) {
    res.status(403).json({
      error: 'No tienes permisos para cargar archivos multimedia.'
    });
    return;
  }

  try {

    // ---------------------------------------------
    // Buscar participante y evento
    // ---------------------------------------------

    const participanteResult = await query(
      `
      SELECT
        p.id AS participante_id,
        c.evento_id
      FROM participantes p
      INNER JOIN categorias c
        ON c.id = p.categoria_id
      WHERE p.id = $1
      `,
      [participanteId]
    );

    if (participanteResult.rows.length === 0) {
      res.status(404).json({
        error: 'Participante no encontrado.'
      });
      return;
    }

    const participante = participanteResult.rows[0];

    // ---------------------------------------------
    // Un participante solo puede tener un video
    // ---------------------------------------------

    if (tipo === 'video') {

      const videoExistente = await query(
        `
        SELECT id
        FROM multimedia
        WHERE participante_id = $1
          AND tipo = 'VIDEO'
          AND activo = true
        LIMIT 1
        `,
        [participanteId]
      );

      if (videoExistente.rows.length > 0) {
        res.status(409).json({
          error: 'Este participante ya tiene un video cargado.'
        });
        return;
      }
    }

    // ---------------------------------------------
    // Limpiar nombre del archivo
    // ---------------------------------------------

    const nombreSeguro = nombreArchivo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    // ---------------------------------------------
    // Generar identificador único
    // ---------------------------------------------

    const fileId = crypto.randomUUID();

    // ---------------------------------------------
    // Generar key de R2
    // ---------------------------------------------

    const r2Key =
      `eventos/${participante.evento_id}` +
      `/participantes/${participanteId}` +
      `/${tipo}/original/${fileId}-${nombreSeguro}`;

    // ---------------------------------------------
    // Generar URL firmada
    // ---------------------------------------------

    const uploadUrl = await generateUploadUrl(
      r2Key,
      mimeType
    );

    res.status(200).json({
      message: 'URL de subida generada correctamente.',
      uploadUrl,
      key: r2Key,
      expiresIn: 900
    });

  } catch (error) {

    console.error(
      'Error generando URL de subida:',
      error
    );

    res.status(500).json({
      error: 'Error al generar la URL de subida.',
      details:
        error instanceof Error
          ? error.message
          : error
    });
  }
};


// =====================================================
// 2. Confirmar subida
// =====================================================

export const confirmMultimediaUpload = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {

  const {
    participanteId,
    tipo,
    nombreArchivo,
    mimeType,
    r2Key
  } = req.body;

  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  if (
    !participanteId ||
    !tipo ||
    !nombreArchivo ||
    !r2Key
  ) {
    res.status(400).json({
      error: 'Faltan datos para confirmar la subida.'
    });
    return;
  }

  if (!['foto', 'video'].includes(tipo)) {
    res.status(400).json({
      error: 'El tipo de multimedia debe ser foto o video.'
    });
    return;
  }

  const tipoDB = tipo.toUpperCase();

  try {

    // ---------------------------------------------
    // Verificar permisos
    // ---------------------------------------------

    const tienePermiso = await verificarRolMultimedia(firebaseUid);

    if (!tienePermiso) {
      res.status(403).json({
        error: 'No tienes permisos para registrar archivos multimedia.'
      });
      return;
    }

    // ---------------------------------------------
    // Verificar participante
    // ---------------------------------------------

    const participanteResult = await query(
      `
      SELECT
        p.id AS participante_id
      FROM participantes p
      WHERE p.id = $1
      `,
      [participanteId]
    );

    if (participanteResult.rows.length === 0) {
      res.status(404).json({
        error: 'Participante no encontrado.'
      });
      return;
    }

    // ---------------------------------------------
    // Verificar que el archivo realmente exista en R2
    // ---------------------------------------------

    let r2Object;

    try {

      r2Object = await checkObjectExists(r2Key);

    } catch (error) {

      console.error(
        'Archivo no encontrado en R2:',
        error
      );

      res.status(400).json({
        error: 'El archivo todavía no existe en Cloudflare R2.'
      });

      return;
    }

    // ---------------------------------------------
    // Validar nuevamente que solo exista un video
    // ---------------------------------------------

    if (tipo === 'video') {

      const videoExistente = await query(
        `
        SELECT id
        FROM multimedia
        WHERE participante_id = $1
          AND tipo = 'video'
          AND activo = true
        LIMIT 1
        `,
        [participanteId]
      );

      if (videoExistente.rows.length > 0) {

        res.status(409).json({
          error: 'Este participante ya tiene un video cargado.'
        });

        return;
      }
    }

    // ---------------------------------------------
    // Insertar multimedia
    // ---------------------------------------------

    const result = await query(
      `
      INSERT INTO multimedia (participante_id, tipo, nombre_archivo, mime_type, tamaño_bytes, r2_original_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id, participante_id, tipo, nombre_archivo, mime_type, tamaño_bytes, r2_original_key, r2_preview_key, activo, fecha_creacion`,
      [
        participanteId,
        tipoDB,
        nombreArchivo,
        mimeType || r2Object.ContentType || null,
        r2Object.ContentLength || null,
        r2Key
      ]
    );

    let previewKey: string | null = null;

    if (tipoDB === 'FOTO') {
      previewKey = await ejecutarPreviewEnCola(
        () => generatePhotoPreview(r2Key)
      );

      await query(
        `
    UPDATE multimedia
    SET r2_preview_key = $1
    WHERE id = $2
    `,
        [
          previewKey,
          result.rows[0].id
        ]
      );

      result.rows[0].r2_preview_key = previewKey;
    }

    res.status(201).json({
      message: 'Multimedia registrado correctamente.',
      multimedia: result.rows[0]
    });

  } catch (error) {

    console.error(
      'Error confirmando multimedia:',
      error
    );

    res.status(500).json({
      error: 'Error al registrar el multimedia.',
      details:
        error instanceof Error
          ? error.message
          : error
    });
  }
};

// =====================================================
// 3. Generar URL temporal para preview
// =====================================================

export const getMultimediaPreviewUrl = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {

  const { id } = req.params;
  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  if (!id) {
    res.status(400).json({
      error: 'No se proporcionó el ID del multimedia.'
    });
    return;
  }

  try {

    // ---------------------------------------------
    // Verificar que el multimedia exista
    // ---------------------------------------------

    const multimediaResult = await query(
      `
      SELECT
        m.id,
        m.participante_id,
        m.tipo,
        m.nombre_archivo,
        m.r2_preview_key,
        m.activo
      FROM multimedia m
      WHERE m.id = $1
      `,
      [id]
    );

    if (multimediaResult.rows.length === 0) {
      res.status(404).json({
        error: 'Multimedia no encontrado.'
      });
      return;
    }

    const multimedia = multimediaResult.rows[0];

    // ---------------------------------------------
    // Verificar que esté activo
    // ---------------------------------------------

    if (!multimedia.activo) {
      res.status(404).json({
        error: 'El multimedia no está disponible.'
      });
      return;
    }

    // ---------------------------------------------
    // Verificar que exista preview
    // ---------------------------------------------

    if (!multimedia.r2_preview_key) {
      res.status(404).json({
        error: 'Este multimedia todavía no tiene un preview.'
      });
      return;
    }

    // ---------------------------------------------
    // Generar URL temporal
    // ---------------------------------------------

    const previewUrl = await generateDownloadUrl(
      multimedia.r2_preview_key,
      300
    );

    res.status(200).json({
      multimediaId: multimedia.id,
      tipo: multimedia.tipo,
      nombreArchivo: multimedia.nombre_archivo,
      previewUrl,
      expiresIn: 300
    });

  } catch (error) {

    console.error(
      'Error generando URL del preview:',
      error
    );

    res.status(500).json({
      error: 'Error generando la URL del preview.',
      details:
        error instanceof Error
          ? error.message
          : error
    });
  }
};

// =====================================================
// 4. Listar multimedia de un participante
// =====================================================

export const getMultimediaByParticipante = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {

  const { participanteId } = req.params;
  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  if (!participanteId) {
    res.status(400).json({
      error: 'No se proporcionó el ID del participante.'
    });
    return;
  }

  try {

    // ---------------------------------------------
    // Verificar que el participante exista
    // ---------------------------------------------

    const participanteResult = await query(
      `
      SELECT
        id
      FROM participantes
      WHERE id = $1
      `,
      [participanteId]
    );

    if (participanteResult.rows.length === 0) {
      res.status(404).json({
        error: 'Participante no encontrado.'
      });
      return;
    }

    // ---------------------------------------------
    // Obtener multimedia
    // ---------------------------------------------

    const multimediaResult = await query(
      `
      SELECT
        id,
        participante_id,
        tipo,
        nombre_archivo,
        mime_type,
        tamaño_bytes,
        r2_preview_key,
        activo,
        fecha_creacion
      FROM multimedia
      WHERE participante_id = $1
        AND activo = true
      ORDER BY fecha_creacion ASC
      `,
      [participanteId]
    );

    // ---------------------------------------------
    // Generar URLs temporales de los previews
    // ---------------------------------------------

    const multimedia = await Promise.all(
      multimediaResult.rows.map(async (item) => {

        let previewUrl: string | null = null;

        if (item.r2_preview_key) {
          previewUrl = await generateDownloadUrl(
            item.r2_preview_key,
            300
          );
        }

        return {
          id: item.id,
          participante_id: item.participante_id,
          tipo: item.tipo,
          nombre_archivo: item.nombre_archivo,
          mime_type: item.mime_type,
          tamaño_bytes: item.tamaño_bytes,
          previewUrl,
          activo: item.activo,
          fecha_creacion: item.fecha_creacion
        };
      })
    );

    res.status(200).json({
      participanteId,
      total: multimedia.length,
      multimedia
    });

  } catch (error) {

    console.error(
      'Error obteniendo multimedia del participante:',
      error
    );

    res.status(500).json({
      error: 'Error obteniendo el multimedia del participante.',
      details:
        error instanceof Error
          ? error.message
          : error
    });
  }
};

export const getMultimediaDownloadUrl = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  if (!id) {
    res.status(400).json({
      error: 'No se proporcionó el ID del multimedia.'
    });
    return;
  }

  try {
    const result = await query(
      `
    SELECT
      m.id,
      m.nombre_archivo,
      m.tipo,
      m.r2_original_key,
      m.activo,
      pe.estado_pago,
      pe.id AS pedido_id,
      pi.id AS pedido_item_id,
      u.firebase_uid
    FROM multimedia m
    INNER JOIN pedido_item_multimedia pim
      ON pim.multimedia_id = m.id
    INNER JOIN pedido_items pi
      ON pi.id = pim.pedido_item_id
    INNER JOIN pedidos pe
      ON pe.id = pi.pedido_id
    INNER JOIN usuarios u
      ON u.id = pe.usuario_id
    WHERE m.id = $1
      AND u.firebase_uid = $2
      AND LOWER(TRIM(pe.estado_pago)) IN (
        'aprobado',
        'approved'
      )
    LIMIT 1
  `,
      [id, firebaseUid]
    );

    if (result.rows.length === 0) {
      res.status(403).json({
        error: 'No tienes acceso a este archivo.'
      });
      return;
    }

    const multimedia = result.rows[0];

    if (!multimedia.activo) {
      res.status(404).json({
        error: 'El archivo no está disponible.'
      });
      return;
    }

    const estadoPago = multimedia.estado_pago?.toString().trim().toLowerCase();
    const pagoAprobado = estadoPago === 'aprobado' || estadoPago === 'approved';

    if (!pagoAprobado) {
      res.status(403).json({
        error: 'El pedido asociado no tiene un pago aprobado.'
      });
      return;
    }

    if (!multimedia.r2_original_key) {
      res.status(404).json({
        error: 'No se encontró el archivo original.'
      });
      return;
    }

    const downloadUrl = await generateDownloadUrl(
      multimedia.r2_original_key,
      300,
      multimedia.nombre_archivo
    );

    res.status(200).json({
      multimediaId: multimedia.id,
      nombreArchivo: multimedia.nombre_archivo,
      tipo: multimedia.tipo,
      downloadUrl,
      expiresIn: 300
    });
  } catch (error) {
    console.error('Error generando URL de descarga:', error);

    res.status(500).json({
      error: 'Error generando la descarga.',
      details: error instanceof Error ? error.message : error
    });
  }
};