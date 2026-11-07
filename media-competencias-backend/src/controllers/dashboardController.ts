import { Response } from 'express';
import pool from '../db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// =====================================================
// DASHBOARD DE EVENTO
// =====================================================
export const getEventDashboard = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { eventoId } = req.params;
  const firebaseUid = req.firebaseUser?.uid;

  // =====================================================
  // 1. VALIDACIONES
  // =====================================================
  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  if (!eventoId) {
    res.status(400).json({
      error: 'No se proporcionó el evento.'
    });
    return;
  }

  const client = await pool.connect();

  try {
    // =====================================================
    // 2. VERIFICAR USUARIO Y ROLES
    // =====================================================
    const usuarioResult = await client.query(
      `
      SELECT
        u.id,
        r.nombre_rol
      FROM usuarios u
      INNER JOIN usuario_roles ur
        ON ur.usuario_id = u.id
      INNER JOIN roles r
        ON r.id = ur.rol_id
      WHERE u.firebase_uid = $1
      `,
      [firebaseUid]
    );

    if (usuarioResult.rows.length === 0) {
      res.status(403).json({
        error: 'El usuario no tiene permisos para acceder al dashboard.'
      });
      return;
    }

    const roles = usuarioResult.rows.map(
      row =>
        row.nombre_rol
          ?.toString()
          .trim()
          .toLowerCase()
    );

    const esAdmin = roles.includes('admin');
    const esTecnico = roles.includes('tecnico');

    if (!esAdmin && !esTecnico) {
      res.status(403).json({
        error: 'No tienes permisos para acceder al dashboard.'
      });
      return;
    }

    // =====================================================
    // 3. VERIFICAR EVENTO
    // =====================================================
    const eventoResult = await client.query(
      `
      SELECT
        id,
        nombre,
        fecha,
        lugar,
        activo
      FROM eventos
      WHERE id = $1
      LIMIT 1
      `,
      [eventoId]
    );

    if (eventoResult.rows.length === 0) {
      res.status(404).json({
        error: 'Evento no encontrado.'
      });
      return;
    }

    const evento = eventoResult.rows[0];

    // =====================================================
    // 4. CONSULTAR PARTICIPANTES
    // =====================================================
    const dashboardResult = await client.query(
      `
      WITH multimedia_resumen AS (
        SELECT
          participante_id,

          COUNT(*) FILTER (
            WHERE tipo = 'FOTO'
              AND activo = TRUE
          ) AS cantidad_fotos,

          COUNT(*) FILTER (
            WHERE tipo = 'VIDEO'
              AND activo = TRUE
          ) AS cantidad_videos,

          STRING_AGG(
            nombre_archivo,
            ', '
            ORDER BY fecha_creacion
          ) FILTER (
            WHERE tipo = 'VIDEO'
              AND activo = TRUE
          ) AS nombres_video,

          MAX(fecha_creacion) FILTER (
            WHERE tipo = 'VIDEO'
              AND activo = TRUE
          ) AS fecha_subida_video,

          MAX(fecha_creacion) FILTER (
            WHERE tipo = 'FOTO'
              AND activo = TRUE
          ) AS fecha_ultima_foto

        FROM multimedia
        GROUP BY participante_id
      ),

      pedidos_resumen AS (
        SELECT
          pi.participante_id,

          BOOL_OR(
            pe.estado_pago = 'aprobado'
          ) AS tiene_pedido_pagado

        FROM pedido_items pi

        INNER JOIN pedidos pe
          ON pe.id = pi.pedido_id

        GROUP BY pi.participante_id
      )

      SELECT
        p.id AS participante_id,

        c.id AS categoria_id,
        c.nombre_categoria,
        c.orden_categoria,

        p.nombre_completo AS participante,
        p.dorsal_numero AS orden,
        p.academia,

        -- =============================================
        -- VIDEO
        -- =============================================

        CASE
          WHEN COALESCE(mr.cantidad_videos, 0) > 0
          THEN 'SUBIDO'
          ELSE 'PENDIENTE'
        END AS estado_video,

        COALESCE(
          mr.nombres_video,
          'SIN ARCHIVO'
        ) AS nombre_archivo,

        mr.fecha_subida_video,

        -- =============================================
        -- FOTOS
        -- =============================================

        COALESCE(
          mr.cantidad_fotos,
          0
        )::int AS cantidad_fotos,

        CASE
          WHEN COALESCE(mr.cantidad_fotos, 0) >= 50
          THEN 'COMPLETO'
          ELSE 'PENDIENTE'
        END AS estado_fotos,

        mr.fecha_ultima_foto,

        -- =============================================
        -- PEDIDO
        -- =============================================

        CASE
          WHEN COALESCE(
            pr.tiene_pedido_pagado,
            FALSE
          )
          THEN 'PAGADO'
          ELSE 'NO PAGADO'
        END AS estado_pedido

      FROM participantes p

      INNER JOIN categorias c
        ON c.id = p.categoria_id

      LEFT JOIN multimedia_resumen mr
        ON mr.participante_id = p.id

      LEFT JOIN pedidos_resumen pr
        ON pr.participante_id = p.id

      WHERE c.evento_id = $1

      ORDER BY
        CASE
          WHEN p.dorsal_numero ~ '^[0-9]+$'
          THEN p.dorsal_numero::integer
          ELSE NULL
        END ASC NULLS LAST,

        p.dorsal_numero ASC,
        c.orden_categoria ASC,
        p.nombre_completo ASC
      `,
      [eventoId]
    );

    let registros = dashboardResult.rows;

    // =====================================================
    // 5. CALCULAR RESUMEN
    // =====================================================
    const totalParticipantes = registros.length;
    const videosSubidos = registros.filter(registro => registro.estado_video === 'SUBIDO').length;
    const videosPendientes = registros.filter(registro => registro.estado_video === 'PENDIENTE').length;
    const pagados = registros.filter(registro => registro.estado_pedido === 'PAGADO').length;
    const noPagados = registros.filter(registro => registro.estado_pedido === 'NO PAGADO').length;
    const fotosCompletas = registros.filter(registro => registro.estado_fotos === 'COMPLETO').length;
    const fotosPendientes = registros.filter(registro => registro.estado_fotos === 'PENDIENTE').length;
    // =====================================================
    // 6. SI ES TÉCNICO: QUITAR INFORMACIÓN DE PAGOS
    // =====================================================
    if (!esAdmin) {
      registros = registros.map(
        registro => {
          const { estado_pedido, ...registroSinPago } = registro;
          return registroSinPago;
        }
      );
    }

    // =====================================================
    // 7. RESPUESTA
    // =====================================================
    res.status(200).json({
      evento,
      rol: esAdmin ? 'admin' : 'tecnico',
      puedeVerPagos: esAdmin,
      resumen: {
      totalParticipantes,
      videosSubidos,
      videosPendientes,
      fotosCompletas,
      fotosPendientes,
      ...(esAdmin
        ? {
            pagados,
            noPagados
          }
        : {})
    },
      total: registros.length,
      registros
    });
  } catch (error) {
    console.error('Error obteniendo dashboard del evento:', error);
    res.status(500).json({
      error: 'Error obteniendo la información del dashboard.',
      details:
        error instanceof Error
          ? error.message
          : error
    });
  } finally {
    client.release();
  }
};