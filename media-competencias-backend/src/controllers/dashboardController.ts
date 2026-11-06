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
      SELECT
        p.id AS participante_id,
        c.id AS categoria_id,
        c.nombre_categoria,
        c.orden_categoria,
        p.nombre_completo AS participante,
        p.dorsal_numero AS orden,
        p.academia,
        -- =============================================
        -- ESTADO DEL VIDEO
        -- =============================================
        CASE
          WHEN COUNT(m.id) FILTER (
            WHERE m.tipo = 'VIDEO'
              AND m.activo = TRUE
          ) > 0
          THEN 'SUBIDO'
          ELSE 'PENDIENTE'
        END AS estado_video,
        -- =============================================
        -- NOMBRE DEL ARCHIVO
        -- =============================================
        COALESCE(
          STRING_AGG(
            DISTINCT m.nombre_archivo,
            ', '
            ORDER BY m.nombre_archivo
          ) FILTER (
            WHERE m.tipo = 'VIDEO'
              AND m.activo = TRUE
          ),
          'SIN ARCHIVO'
        ) AS nombre_archivo,
        -- =============================================
        -- FECHA DE SUBIDA DEL VIDEO
        -- =============================================
        MAX(
          m.fecha_creacion
        ) FILTER (
          WHERE m.tipo = 'VIDEO'
            AND m.activo = TRUE
        ) AS fecha_subida_video,
        -- =============================================
        -- ESTADO DEL PEDIDO
        -- =============================================
        CASE
          WHEN BOOL_OR(
            pe.estado_pago = 'aprobado'
          )
          THEN 'PAGADO'
          ELSE 'NO PAGADO'
        END AS estado_pedido
      FROM participantes p
      INNER JOIN categorias c
        ON c.id = p.categoria_id
      LEFT JOIN multimedia m
        ON m.participante_id = p.id
       AND m.activo = TRUE
      LEFT JOIN pedido_items pi
        ON pi.participante_id = p.id
      LEFT JOIN pedidos pe
        ON pe.id = pi.pedido_id
      WHERE c.evento_id = $1
      GROUP BY
        p.id,
        c.id,
        c.nombre_categoria,
        c.orden_categoria,
        p.nombre_completo,
        p.dorsal_numero,
        p.academia
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
    const videosSubidos = registros.filter(
      registro => registro.estado_video === 'SUBIDO'
    ).length;
    const videosPendientes = registros.filter(
      registro => registro.estado_video === 'PENDIENTE'
    ).length;
    const pagados = registros.filter(
      registro => registro.estado_pedido === 'PAGADO'
    ).length;
    const noPagados = registros.filter(
      registro => registro.estado_pedido === 'NO PAGADO'
    ).length;

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