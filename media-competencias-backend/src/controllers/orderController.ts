import { Response } from 'express';
import pool from '../db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { generateDownloadUrl } from '../services/r2Services';

export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {

  const { nombre, email, whatsapp, items } = req.body;

  // =====================================================
  // 1. Validación básica
  // =====================================================

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    res.status(400).json({
      error: 'Datos incompletos o formato de carrito inválido.'
    });
    return;
  }

  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    // =====================================================
    // 2. Obtener usuario autenticado
    // =====================================================

    const userResult = await client.query(
      `
      SELECT id
      FROM usuarios
      WHERE firebase_uid = $1
      `,
      [firebaseUid]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');

      res.status(404).json({
        error: 'Usuario no encontrado en la base de datos.'
      });
      return;
    }

    const usuarioId = userResult.rows[0].id;

    // =====================================================
    // 3. Procesar cada item
    // =====================================================

    let montoTotal = 0;

    const itemsProcesados: {
      paquete_id: string;
      participante_id: string;
      multimedia_ids: string[];
      tipo_compra: 'RESERVA' | 'DIRECTA';
    }[] = [];

    for (const item of items) {

      const {
        paquete_id,
        participante_id,
        tipo_compra,
        multimedia_ids
      } = item;

      // -------------------------------------------------
      // Validación de estructura
      // -------------------------------------------------

      if (
        !paquete_id || !participante_id || !tipo_compra || !Array.isArray(multimedia_ids)
      ) {
        throw new Error(
          'Cada item debe contener paquete_id, participante_id, tipo_compra y multimedia_ids.'
        );
      }

      if (
        tipo_compra !== 'RESERVA' && tipo_compra !== 'DIRECTA'
      ) {
        throw new Error(
          'El tipo de compra debe ser RESERVA o DIRECTA.'
        );
      }

      // -------------------------------------------------
      // 3.1 Obtener paquete
      // -------------------------------------------------

      const packageResult = await client.query(
        `
        SELECT
          id,
          evento_id,
          nombre_paquete,
          precio,
          tipo,
          modalidad,
          cantidad_fotos,
          tipo_formato
        FROM paquetes
        WHERE id = $1
        `,
        [paquete_id]
      );

      if (packageResult.rows.length === 0) {
        throw new Error(
          `El paquete ${paquete_id} no existe.`
        );
      }

      const paquete = packageResult.rows[0];

      // -------------------------------------------------
      // 3.2 Obtener participante
      // -------------------------------------------------

      const participanteResult = await client.query(
        `
        SELECT
          p.id,
          c.evento_id,
          c.tipo_categoria
        FROM participantes p
        INNER JOIN categorias c
          ON c.id = p.categoria_id
        WHERE p.id = $1
        `,
        [participante_id]
      );



      if (participanteResult.rows.length === 0) {
        throw new Error(
          `El participante ${participante_id} no existe.`
        );
      }

      const participante = participanteResult.rows[0];

      // -------------------------------------------------
      // 3.3 Validar que paquete y participante
      //     pertenezcan al mismo evento
      // -------------------------------------------------
      const tipoCategoria = participante.tipo_categoria?.toLowerCase();

      let modalidadParticipante: string;

      if (
        tipoCategoria === 'solista' || tipoCategoria === 'duo'
      ) {
        modalidadParticipante = 'SOLISTA_DUO';
      } else if (
        tipoCategoria === 'grupal'
      ) {
        modalidadParticipante = 'GRUPAL';
      } else {
        throw new Error(
          `La categoría del participante no tiene un tipo válido.`
        );
      }
      // -------------------------------------------------
      // 3.4 Validar modalidad
      // -------------------------------------------------
      const modalidadPaquete = paquete.modalidad?.toString().trim().toUpperCase();
      const modalidadParticipanteNormalizada = modalidadParticipante?.toString().trim().toUpperCase();

      if (
        modalidadPaquete !== 'TODOS' &&
        modalidadPaquete !== modalidadParticipanteNormalizada
      ) {
        throw new Error(
          `El paquete "${paquete.nombre_paquete}" no es compatible con la modalidad del participante.`
        );
      }

      if (!paquete.evento_id || participante.evento_id !== paquete.evento_id) {
        throw new Error(`El paquete "${paquete.nombre_paquete}" no pertenece al evento del participante.`);
      }

      // VALIDAR  
      if (
        tipo_compra === 'RESERVA' && multimedia_ids.length > 0
      ) {
        throw new Error(
          'Una reserva no debe contener archivos multimedia seleccionados.'
        );
      }

      if (
        tipo_compra === 'DIRECTA' && multimedia_ids.length === 0
      ) {
        throw new Error(
          'Una compra directa debe contener multimedia seleccionado.'
        );
      }


      // -------------------------------------------------
      // 3.5 Validar multimedia seleccionados
      // -------------------------------------------------
      let multimediaIdsUnicos: string[] = [];

      if (tipo_compra === 'DIRECTA') {

        // Eliminar duplicados para validar correctamente
        multimediaIdsUnicos = [...new Set(multimedia_ids)];

        if (
          multimediaIdsUnicos.length !== multimedia_ids.length
        ) {
          throw new Error(
            `No puedes seleccionar el mismo multimedia más de una vez.`
          );
        }

        // -------------------------------------------------
        // 3.6 Obtener multimedia
        // -------------------------------------------------

        let multimediaRows: any[] = [];

        if (multimediaIdsUnicos.length > 0) {

          const multimediaResult = await client.query(
            `
          SELECT
            id,
            participante_id,
            tipo,
            activo
          FROM multimedia
          WHERE id = ANY($1::uuid[])
          `,
            [multimediaIdsUnicos]
          );

          multimediaRows = multimediaResult.rows;
        }

        // -------------------------------------------------
        // Verificar que todos existan
        // -------------------------------------------------

        if (
          multimediaRows.length !==
          multimediaIdsUnicos.length
        ) {
          throw new Error(
            `Uno o más multimedia seleccionados no existen.`
          );
        }

        // -------------------------------------------------
        // Verificar que pertenezcan al participante
        // -------------------------------------------------

        for (const multimedia of multimediaRows) {

          if (
            multimedia.participante_id !==
            participante_id
          ) {
            throw new Error(
              `Uno de los multimedia seleccionados no pertenece al participante.`
            );
          }

          if (!multimedia.activo) {
            throw new Error(
              `Uno de los multimedia seleccionados no está disponible.`
            );
          }
        }

        // -------------------------------------------------
        // 3.7 Contar fotos y videos
        // -------------------------------------------------

        const cantidadFotos = multimediaRows.filter(
          multimedia => multimedia.tipo === 'FOTO'
        ).length;

        const cantidadVideos = multimediaRows.filter(
          multimedia => multimedia.tipo === 'VIDEO'
        ).length;

        // -------------------------------------------------
        // 3.8 Validar según tipo de paquete
        // -------------------------------------------------

        if (paquete.tipo === 'foto') {

          if (
            cantidadFotos !==
            paquete.cantidad_fotos
          ) {
            throw new Error(
              `El paquete "${paquete.nombre_paquete}" requiere exactamente ${paquete.cantidad_fotos} fotos.`
            );
          }

          if (cantidadVideos !== 0) {
            throw new Error(
              `El paquete "${paquete.nombre_paquete}" no permite seleccionar videos.`
            );
          }
        }
        // -------------------------------------------------

        if (paquete.tipo === 'video') {

          if (cantidadFotos !== 0) {
            throw new Error(
              `El paquete "${paquete.nombre_paquete}" no permite seleccionar fotos.`
            );
          }

          if (cantidadVideos !== 1) {
            throw new Error(
              `El paquete "${paquete.nombre_paquete}" requiere exactamente 1 video.`
            );
          }
        }

        // -------------------------------------------------

        if (paquete.tipo === 'combo') {

          if (
            cantidadFotos !==
            paquete.cantidad_fotos
          ) {
            throw new Error(
              `El paquete "${paquete.nombre_paquete}" requiere exactamente ${paquete.cantidad_fotos} fotos.`
            );
          }

          if (cantidadVideos !== 1) {
            throw new Error(
              `El paquete "${paquete.nombre_paquete}" requiere exactamente 1 video.`
            );
          }
        }
      }

      if (tipo_compra === 'RESERVA') {
        multimediaIdsUnicos = [];
      }
      // -------------------------------------------------
      // 3.9 Agregar precio real
      // -------------------------------------------------

      const precioReal =  Number(paquete.precio);

      if (
        !Number.isFinite(precioReal) ||
        precioReal < 0
      ) {
        throw new Error(
          `El paquete "${paquete.nombre_paquete}" tiene un precio inválido.`
        );
      }
      montoTotal += precioReal;

      itemsProcesados.push({
        paquete_id,
        participante_id,
        multimedia_ids: multimediaIdsUnicos,
        tipo_compra
      });
    }
    // =====================================================
    // 4. Crear pedido
    // =====================================================

    const pedidoResult = await client.query(
      `
      INSERT INTO pedidos (
        usuario_id,
        monto_total,
        estado_pago
      )
      VALUES (
        $1,
        $2,
        'pendiente'
      )
      RETURNING
        id,
        monto_total,
        estado_pago
      `,
      [
        usuarioId,
        montoTotal
      ]
    );

    const nuevoPedido = pedidoResult.rows[0];

    // =====================================================
    // 5. Crear pedido_items
    // =====================================================

    for (const item of itemsProcesados) {

      const pedidoItemResult = await client.query(
        `
        INSERT INTO pedido_items (
          pedido_id,
          participante_id,
          paquete_id
        )
        VALUES (
          $1,
          $2,
          $3
        )
        RETURNING id
        `,
        [
          nuevoPedido.id,
          item.participante_id,
          item.paquete_id
        ]
      );

      const pedidoItemId =
        pedidoItemResult.rows[0].id;

      // ===================================================
      // 6. Asociar multimedia al pedido_item
      // ===================================================

      for (const multimediaId of item.multimedia_ids) {

        await client.query(
          `
          INSERT INTO pedido_item_multimedia (
            pedido_item_id,
            multimedia_id
          )
          VALUES (
            $1,
            $2
          )
          `,
          [
            pedidoItemId,
            multimediaId
          ]
        );
      }
    }

    // =====================================================
    // 7. Confirmar transacción
    // =====================================================

    await client.query('COMMIT');

    // =====================================================
    // 8. Respuesta
    // =====================================================

    res.status(201).json({
      message: 'Pedido creado exitosamente en estado PENDIENTE.',
      pedido: {
        id: nuevoPedido.id,
        monto_total: nuevoPedido.monto_total,
        estado_pago: nuevoPedido.estado_pago
      }
    });

  } catch (error) {

    await client.query('ROLLBACK');

    console.error(
      'Error al crear pedido:',
      error
    );

    res.status(400).json({
      error: 'No se pudo crear el pedido.',
      details:
        error instanceof Error
          ? error.message
          : error
    });

  } finally {

    client.release();
  }
};

export const getMyPurchases = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {

  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  const client = await pool.connect();

  try {

    // =====================================================
    // 1. Obtener usuario
    // =====================================================

    const userResult = await client.query(
      `
      SELECT id
      FROM usuarios
      WHERE firebase_uid = $1
      `,
      [firebaseUid]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: 'Usuario no encontrado.'
      });
      return;
    }

    const usuarioId = userResult.rows[0].id;

    // =====================================================
    // 2. Obtener pedidos + items + participante + paquete
    // =====================================================

    const result = await client.query(
      `
      SELECT
        pe.id AS pedido_id,
        pe.monto_total,
        pe.estado_pago,
        pe.fecha_creacion,

        pi.id AS pedido_item_id,

        p.id AS participante_id,
        p.nombre_completo,
        p.dorsal_numero,

        c.nombre_categoria,
        c.tipo_categoria,

        e.id AS evento_id,
        e.nombre AS evento_nombre,
        e.fecha AS evento_fecha,

        pa.id AS paquete_id,
        pa.nombre_paquete,
        pa.tipo AS paquete_tipo,
        pa.modalidad,
        pa.cantidad_fotos,
        pa.tipo_formato,
        pa.precio,

        (
          SELECT COUNT(*)
          FROM pedido_item_multimedia pim
          WHERE pim.pedido_item_id = pi.id
        )::int AS multimedia_seleccionados,

        (
          SELECT COUNT(*)
          FROM pedido_item_multimedia pim
          INNER JOIN multimedia m
            ON m.id = pim.multimedia_id
          WHERE pim.pedido_item_id = pi.id
            AND m.tipo = 'FOTO'
            AND m.activo = true
        )::int AS fotos_seleccionadas,

        (
          SELECT COUNT(*)
          FROM pedido_item_multimedia pim
          INNER JOIN multimedia m
            ON m.id = pim.multimedia_id
          WHERE pim.pedido_item_id = pi.id
            AND m.tipo = 'VIDEO'
            AND m.activo = true
        )::int AS videos_seleccionados,

        (
          SELECT COUNT(*)
          FROM multimedia m
          WHERE m.participante_id = p.id
            AND m.tipo = 'FOTO'
            AND m.activo = true
            AND m.r2_preview_key IS NOT NULL
        )::int AS fotos_disponibles,

        (
          SELECT COUNT(*)
          FROM multimedia m
          WHERE m.participante_id = p.id
            AND m.tipo = 'VIDEO'
            AND m.activo = true
        )::int AS videos_disponibles

      FROM pedidos pe

      INNER JOIN pedido_items pi
        ON pi.pedido_id = pe.id

      INNER JOIN participantes p
        ON p.id = pi.participante_id

      INNER JOIN categorias c
        ON c.id = p.categoria_id

      INNER JOIN eventos e
        ON e.id = c.evento_id

      INNER JOIN paquetes pa
        ON pa.id = pi.paquete_id

      WHERE pe.usuario_id = $1

      ORDER BY
        pe.fecha_creacion DESC,
        pi.id
      `,
      [usuarioId]
    );

    // =====================================================
    // 3. Agrupar items por pedido
    // =====================================================

    const pedidosMap = new Map<string, any>();

    for (const row of result.rows) {

      if (!pedidosMap.has(row.pedido_id)) {
        pedidosMap.set(row.pedido_id, {
          id: row.pedido_id,
          monto_total: row.monto_total,
          estado_pago: row.estado_pago,
          fecha_creacion: row.fecha_creacion,
          items: []
        });
      }

      // ===================================================
      // 4. Determinar estado del material
      // ===================================================

      let estadoMaterial:
        | 'PAGO_PENDIENTE'
        | 'MATERIAL_PENDIENTE'
        | 'DISPONIBLE_PARA_SELECCIONAR'
        | 'MATERIAL_SELECCIONADO';

      /*
       * IMPORTANTE:
       * Ajusta "aprobado" al valor exacto que estés guardando
       * actualmente en estado_pago.
       */
      const pagoAprobado =
        row.estado_pago
          ?.toString()
          .trim()
          .toLowerCase() === 'aprobado';

      if (!pagoAprobado) {

        estadoMaterial = 'PAGO_PENDIENTE';

      } else if (row.multimedia_seleccionados > 0) {

        estadoMaterial = 'MATERIAL_SELECCIONADO';

      } else {

        let materialSuficiente = false;

        if (row.paquete_tipo === 'foto') {

          materialSuficiente =
            row.fotos_disponibles >=
            Number(row.cantidad_fotos || 0);

        } else if (row.paquete_tipo === 'video') {

          materialSuficiente =
            row.videos_disponibles >= 1;

        } else if (row.paquete_tipo === 'combo') {

          materialSuficiente =
            row.fotos_disponibles >=
              Number(row.cantidad_fotos || 0) &&
            row.videos_disponibles >= 1;
        }

        estadoMaterial =
          materialSuficiente
            ? 'DISPONIBLE_PARA_SELECCIONAR'
            : 'MATERIAL_PENDIENTE';
      }

      // ===================================================
      // 5. Agregar item
      // ===================================================

      pedidosMap.get(row.pedido_id).items.push({
        pedido_item_id: row.pedido_item_id,

        evento: {
          id: row.evento_id,
          nombre: row.evento_nombre,
          fecha: row.evento_fecha
        },

        participante: {
          id: row.participante_id,
          nombre_completo: row.nombre_completo,
          dorsal_numero: row.dorsal_numero,
          nombre_categoria: row.nombre_categoria,
          tipo_categoria: row.tipo_categoria
        },

        paquete: {
          id: row.paquete_id,
          nombre_paquete: row.nombre_paquete,
          tipo: row.paquete_tipo,
          modalidad: row.modalidad,
          cantidad_fotos: Number(
            row.cantidad_fotos || 0
          ),
          tipo_formato: row.tipo_formato,
          precio: Number(row.precio)
        },

        multimedia_seleccionados:
          row.multimedia_seleccionados,

        fotos_seleccionadas:
          row.fotos_seleccionadas,

        videos_seleccionados:
          row.videos_seleccionados,

        fotos_disponibles:
          row.fotos_disponibles,

        videos_disponibles:
          row.videos_disponibles,

        estado_material:
          estadoMaterial
      });
    }

    // =====================================================
    // 6. Respuesta
    // =====================================================

    res.status(200).json({
      total: pedidosMap.size,
      pedidos: Array.from(
        pedidosMap.values()
      )
    });

  } catch (error) {

    console.error(
      'Error obteniendo mis compras:',
      error
    );

    res.status(500).json({
      error: 'Error al obtener las compras del usuario.',
      details:
        error instanceof Error
          ? error.message
          : error
    });

  } finally {

    client.release();
  }
};

export const selectMaterialForOrderItem = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { pedidoItemId } = req.params;
  const { multimedia_ids } = req.body;
  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({ error: 'Usuario no autenticado.' });
    return;
  }

  if (!pedidoItemId || !Array.isArray(multimedia_ids) || multimedia_ids.length === 0) {
    res.status(400).json({ error: 'Debes proporcionar multimedia_ids.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // =====================================================
    // 1. Obtener pedido_item y validar propietario
    // =====================================================
    const itemResult = await client.query(
      `
      SELECT
        pi.id AS pedido_item_id,
        pi.participante_id,
        pi.paquete_id,
        pe.id AS pedido_id,
        pe.estado_pago,
        pe.usuario_id,
        u.firebase_uid,
        pa.nombre_paquete,
        pa.tipo AS paquete_tipo,
        pa.cantidad_fotos
      FROM pedido_items pi
      INNER JOIN pedidos pe ON pe.id = pi.pedido_id
      INNER JOIN usuarios u ON u.id = pe.usuario_id
      INNER JOIN paquetes pa ON pa.id = pi.paquete_id
      WHERE pi.id = $1
      `,
      [pedidoItemId]
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Pedido item no encontrado.' });
      return;
    }

    const item = itemResult.rows[0];

    // =====================================================
    // 2. Verificar que pertenece al usuario
    // =====================================================
    if (item.firebase_uid !== firebaseUid) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'No tienes acceso a este pedido.' });
      return;
    }

    // =====================================================
    // 3. Verificar pago aprobado
    // =====================================================
    const estadoPago = item.estado_pago?.toString().trim().toLowerCase();
    const pagoAprobado = estadoPago === 'aprobado' || estadoPago === 'approved';

    if (!pagoAprobado) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El pedido todavía no tiene un pago aprobado.' });
      return;
    }

    // =====================================================
    // 4. Verificar que no tenga selección previa
    // =====================================================
    const seleccionExistente = await client.query(
      `
      SELECT id
      FROM pedido_item_multimedia
      WHERE pedido_item_id = $1
      LIMIT 1
      `,
      [pedidoItemId]
    );

    if (seleccionExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Este pedido ya tiene material seleccionado.' });
      return;
    }

    // =====================================================
    // 5. Evitar multimedia duplicado
    // =====================================================
    const multimediaIdsUnicos = [...new Set(multimedia_ids)];

    if (multimediaIdsUnicos.length !== multimedia_ids.length) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'No puedes seleccionar el mismo archivo más de una vez.' });
      return;
    }

    // =====================================================
    // 6. Obtener multimedia
    // =====================================================
    const multimediaResult = await client.query(
      `
      SELECT
        id,
        participante_id,
        tipo,
        activo,
        r2_preview_key
      FROM multimedia
      WHERE id = ANY($1::uuid[])
      `,
      [multimediaIdsUnicos]
    );

    if (multimediaResult.rows.length !== multimediaIdsUnicos.length) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Uno o más archivos seleccionados no existen.' });
      return;
    }

    const multimediaRows = multimediaResult.rows;

    // =====================================================
    // 7. Validar participante y disponibilidad
    // =====================================================
    for (const multimedia of multimediaRows) {
      if (multimedia.participante_id !== item.participante_id) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Uno de los archivos no pertenece al participante del pedido.' });
        return;
      }

      if (!multimedia.activo) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Uno de los archivos seleccionados no está disponible.' });
        return;
      }

      if (multimedia.tipo === 'FOTO' && !multimedia.r2_preview_key) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Una de las fotografías todavía no tiene preview disponible.' });
        return;
      }
    }

    // =====================================================
    // 8. Contar fotos y videos
    // =====================================================
    const cantidadFotos = multimediaRows.filter(m => m.tipo === 'FOTO').length;
    const cantidadVideos = multimediaRows.filter(m => m.tipo === 'VIDEO').length;
    const fotosRequeridas = Number(item.cantidad_fotos || 0);

    // =====================================================
    // 9. Validar según paquete
    // =====================================================
    if (item.paquete_tipo === 'foto') {
      if (cantidadFotos !== fotosRequeridas || cantidadVideos !== 0) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `El paquete "${item.nombre_paquete}" requiere exactamente ${fotosRequeridas} fotos y ningún video.`
        });
        return;
      }
    } else if (item.paquete_tipo === 'video') {
      if (cantidadFotos !== 0 || cantidadVideos !== 1) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `El paquete "${item.nombre_paquete}" requiere exactamente 1 video.`
        });
        return;
      }
    } else if (item.paquete_tipo === 'combo') {
      if (cantidadFotos !== fotosRequeridas || cantidadVideos !== 1) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `El paquete "${item.nombre_paquete}" requiere exactamente ${fotosRequeridas} fotos y 1 video.`
        });
        return;
      }
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El paquete tiene un tipo inválido.' });
      return;
    }

    // =====================================================
    // 10. Guardar selección
    // =====================================================
    for (const multimediaId of multimediaIdsUnicos) {
      await client.query(
        `
        INSERT INTO pedido_item_multimedia (
          pedido_item_id,
          multimedia_id
        )
        VALUES ($1, $2)
        `,
        [pedidoItemId, multimediaId]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Material seleccionado correctamente.',
      pedido_item_id: pedidoItemId,
      multimedia_seleccionados: multimediaIdsUnicos.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seleccionando material:', error);

    res.status(500).json({
      error: 'Error al seleccionar el material.',
      details: error instanceof Error ? error.message : error
    });

  } finally {
    client.release();
  }
};

export const getOrderItemFiles = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { pedidoItemId } = req.params;
  const firebaseUid = req.firebaseUser?.uid;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  if (!pedidoItemId) {
    res.status(400).json({
      error: 'No se proporcionó el pedido_item_id.'
    });
    return;
  }

  const client = await pool.connect();

  try {
    // =====================================================
    // 1. Validar pedido_item + propietario + pago
    // =====================================================
    const itemResult = await client.query(
      `
      SELECT
        pi.id AS pedido_item_id,
        pi.participante_id,
        pi.paquete_id,
        pe.id AS pedido_id,
        pe.estado_pago,
        u.firebase_uid,
        p.nombre_completo,
        p.dorsal_numero,
        pa.nombre_paquete,
        pa.tipo AS paquete_tipo,
        pa.cantidad_fotos
      FROM pedido_items pi
      INNER JOIN pedidos pe ON pe.id = pi.pedido_id
      INNER JOIN usuarios u ON u.id = pe.usuario_id
      INNER JOIN participantes p ON p.id = pi.participante_id
      INNER JOIN paquetes pa ON pa.id = pi.paquete_id
      WHERE pi.id = $1
      `,
      [pedidoItemId]
    );

    if (itemResult.rows.length === 0) {
      res.status(404).json({
        error: 'Pedido item no encontrado.'
      });
      return;
    }

    const item = itemResult.rows[0];

    if (item.firebase_uid !== firebaseUid) {
      res.status(403).json({
        error: 'No tienes acceso a este pedido.'
      });
      return;
    }

    const estadoPago = item.estado_pago?.toString().trim().toLowerCase();
    const pagoAprobado = estadoPago === 'aprobado' || estadoPago === 'approved';

    if (!pagoAprobado) {
      res.status(403).json({
        error: 'El pedido todavía no tiene un pago aprobado.'
      });
      return;
    }

    // =====================================================
    // 2. Obtener multimedia asociado al pedido_item
    // =====================================================
    const multimediaResult = await client.query(
      `
      SELECT
        m.id,
        m.tipo,
        m.nombre_archivo,
        m.mime_type,
        m.tamaño_bytes,
        m.r2_preview_key,
        m.activo,
        m.fecha_creacion
      FROM pedido_item_multimedia pim
      INNER JOIN multimedia m ON m.id = pim.multimedia_id
      WHERE pim.pedido_item_id = $1
        AND m.activo = true
      ORDER BY
        CASE
          WHEN m.tipo = 'FOTO' THEN 1
          WHEN m.tipo = 'VIDEO' THEN 2
          ELSE 3
        END,
        m.fecha_creacion ASC
      `,
      [pedidoItemId]
    );

    // =====================================================
    // 3. Generar previews SOLO para fotos
    // =====================================================
    const archivos = await Promise.all(
      multimediaResult.rows.map(async (archivo) => {
        let previewUrl: string | null = null;

        if (archivo.tipo === 'FOTO' && archivo.r2_preview_key) {
          previewUrl = await generateDownloadUrl(
            archivo.r2_preview_key,
            300
          );
        }

        return {
          id: archivo.id,
          tipo: archivo.tipo,
          nombre_archivo: archivo.nombre_archivo,
          mime_type: archivo.mime_type,
          tamaño_bytes: archivo.tamaño_bytes,
          previewUrl,
          fecha_creacion: archivo.fecha_creacion
        };
      })
    );

    // =====================================================
    // 4. Respuesta
    // =====================================================
    res.status(200).json({
      pedido_item_id: item.pedido_item_id,
      participante: {
        id: item.participante_id,
        nombre_completo: item.nombre_completo,
        dorsal_numero: item.dorsal_numero
      },
      paquete: {
        id: item.paquete_id,
        nombre_paquete: item.nombre_paquete,
        tipo: item.paquete_tipo,
        cantidad_fotos: Number(item.cantidad_fotos || 0)
      },
      total_archivos: archivos.length,
      archivos
    });
  } catch (error) {
    console.error('Error obteniendo archivos del pedido:', error);

    res.status(500).json({
      error: 'Error al obtener los archivos del pedido.',
      details: error instanceof Error ? error.message : error
    });
  } finally {
    client.release();
  }
};