import { Response } from 'express';
import crypto from 'crypto';
import pool, { query } from '../db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

// ======================================================
// 1. PREPARAR TRANSACCIÓN PARA CAJITA
// ======================================================

export const initiatePayment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { pedidoId } = req.body || {};

  if (!pedidoId) {
    res.status(400).json({
      error: 'Se requiere el pedidoId para iniciar el pago.'
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

  try {
    // ====================================================
    // 1. Buscar pedido
    // ====================================================

    const pedidoQuery = await query(
      `
      SELECT
        p.id,
        p.monto_total,
        p.estado_pago,
        u.firebase_uid,
        u.email,
        u.nombre,
        u.apellido,
        u.celular
      FROM pedidos p
      INNER JOIN usuarios u
        ON u.id = p.usuario_id
      WHERE p.id = $1
        AND u.firebase_uid = $2
      LIMIT 1
      `,
      [
        pedidoId,
        firebaseUid
      ]
    );

    if (pedidoQuery.rows.length === 0) {
      res.status(404).json({
        error: 'Pedido no encontrado.'
      });
      return;
    }

    const pedido = pedidoQuery.rows[0];

    const estadoPago = pedido.estado_pago
      ?.toString()
      .trim()
      .toLowerCase();

    if (
      estadoPago === 'aprobado' ||
      estadoPago === 'approved'
    ) {
      res.status(400).json({
        error: 'Este pedido ya fue pagado.'
      });
      return;
    }

    // ====================================================
    // 2. Validar variables Payphone
    // ====================================================

    const token = process.env.PAYPHONE_TOKEN;
    const storeId = process.env.PAYPHONE_STORE_ID;

    if (
      !token ||
      !storeId
    ) {
      res.status(500).json({
        error: 'Configuración de Payphone incompleta.'
      });
      return;
    }

    // ====================================================
    // 3. Monto en centavos
    // ====================================================

    const monto = Number(pedido.monto_total);

    if (
      !Number.isFinite(monto) ||
      monto <= 0
    ) {
      res.status(400).json({
        error: 'El monto del pedido no es válido.'
      });
      return;
    }

    const amount = Math.round(monto * 100);

    // ====================================================
    // 4. Generar clientTransactionId
    // ====================================================

    const clientTransactionId = `R${Date.now()
      .toString()
      .slice(-10)}${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    // ====================================================
    // 5. Guardarlo en el pedido
    // ====================================================

    await query(
      `
      UPDATE pedidos
      SET
        placetopay_session_id = $1,
        estado_pago = 'pendiente'
      WHERE id = $2
      `,
      [
        clientTransactionId,
        pedido.id
      ]
    );

    // ====================================================
    // 6. Datos necesarios para renderizar Cajita
    // ====================================================

    res.status(200).json({
      message: 'Transacción preparada correctamente.',
      pedidoId: pedido.id,
      clientTransactionId,
      amount,
      amountWithoutTax: amount,
      amountWithTax: 0,
      tax: 0,
      currency: 'USD',
      storeId,
      reference: `Pedido RECAP ${pedido.id}`,
      email: pedido.email || '',
      phoneNumber: pedido.celular || '',
      /*
       * La Cajita requiere el token
       * en su configuración de frontend.
       */
      token
    });

  } catch (error) {
    console.error(
      'Error preparando pago Payphone:',
      error
    );

    res.status(500).json({
      error: 'Error al preparar el pago.',
      details:
        error instanceof Error
          ? error.message
          : error
    });
  }
};

// ======================================================
// 2. CONFIRMAR PAGO PAYPHONE
// ======================================================

export const confirmPayment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const firebaseUid = req.firebaseUser?.uid;
  const {
    id,
    clientTransactionId
  } = req.body;

  if (!firebaseUid) {
    res.status(401).json({
      error: 'Usuario no autenticado.'
    });
    return;
  }

  if (
    !id ||
    !clientTransactionId
  ) {
    res.status(400).json({
      error: 'Se requieren id y clientTransactionId.'
    });
    return;
  }

  const token = process.env.PAYPHONE_TOKEN;

  if (!token) {
    res.status(500).json({
      error: 'PAYPHONE_TOKEN no está configurado.'
    });
    return;
  }

  const client = await pool.connect();

  try {
    // ====================================================
    // 1. Buscar pedido por clientTransactionId
    // ====================================================

    const pedidoResult = await client.query(
      `
      SELECT
        p.id,
        p.monto_total,
        p.estado_pago,
        p.placetopay_session_id,
        u.firebase_uid
      FROM pedidos p
      INNER JOIN usuarios u
        ON u.id = p.usuario_id
      WHERE p.placetopay_session_id = $1
      LIMIT 1
      `,
      [
        clientTransactionId
      ]
    );

    if (pedidoResult.rows.length === 0) {
      res.status(404).json({
        error: 'No se encontró un pedido asociado a esta transacción.'
      });
      return;
    }

    const pedido = pedidoResult.rows[0];

    if (
      pedido.firebase_uid !==
      firebaseUid
    ) {
      res.status(403).json({
        error: 'No tienes acceso a este pedido.'
      });
      return;
    }

    // ====================================================
    // 2. Confirmar con Payphone
    // ====================================================

    const confirmBody = {
      id: Number(id),
      clientTxId: clientTransactionId
    };

    const payphoneResponse = await fetch(
      PAYPHONE_CONFIRM_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(
          confirmBody
        )
      }
    );

    const payphoneData = await payphoneResponse.json();

    if (!payphoneResponse.ok) {
      console.error(
        'Error Payphone Confirm:',
        payphoneData
      );

      res.status(502).json({
        error: 'No se pudo confirmar la transacción con Payphone.',
        details: payphoneData
      });

      return;
    }

    // ====================================================
    // 3. Validar transacción devuelta
    // ====================================================

    const montoEsperado = Math.round(
      Number(
        pedido.monto_total
      ) * 100
    );

    const montoRecibido = Number(
      payphoneData.amount
    );

    if (
      montoRecibido !==
      montoEsperado
    ) {
      console.error(
        'Monto Payphone no coincide:',
        {
          pedidoId: pedido.id,
          esperado: montoEsperado,
          recibido: montoRecibido
        }
      );

      res.status(400).json({
        error: 'El monto confirmado por Payphone no coincide con el pedido.'
      });

      return;
    }

    if (
      payphoneData.clientTransactionId !==
      clientTransactionId
    ) {
      res.status(400).json({
        error: 'El identificador de la transacción no coincide.'
      });

      return;
    }

    // ====================================================
    // 4. Obtener estado
    // ====================================================

    const statusCode = Number(
      payphoneData.statusCode
    );

    const transactionStatus = payphoneData.transactionStatus
      ?.toString()
      .trim()
      .toLowerCase();

    let nuevoEstado:
      | 'aprobado'
      | 'fallido'
      | 'pendiente';

    if (
      statusCode === 3 ||
      transactionStatus === 'approved'
    ) {
      nuevoEstado = 'aprobado';
    } else if (
      statusCode === 2 ||
      transactionStatus === 'canceled' ||
      transactionStatus === 'cancelled'
    ) {
      nuevoEstado = 'fallido';
    } else {
      nuevoEstado = 'pendiente';
    }

    // ====================================================
    // 5. Actualizar BD
    // ====================================================

    await client.query('BEGIN');

    await client.query(
      `
      UPDATE pedidos
      SET estado_pago = $1
      WHERE id = $2
      `,
      [
        nuevoEstado,
        pedido.id
      ]
    );

    // ====================================================
    // 6. Crear tracking técnico si aprobado
    // ====================================================

    if (
      nuevoEstado === 'aprobado'
    ) {
      const itemsQuery = await client.query(
        `
        SELECT id
        FROM pedido_items
        WHERE pedido_id = $1
        `,
        [
          pedido.id
        ]
      );

      for (
        const item of itemsQuery.rows
      ) {
        await client.query(
          `
          INSERT INTO tracking_tecnico (
            pedido_item_id
          )
          VALUES ($1)
          ON CONFLICT (
            pedido_item_id
          )
          DO NOTHING
          `,
          [
            item.id
          ]
        );
      }
    }

    await client.query('COMMIT');

    // ====================================================
    // 7. Respuesta
    // ====================================================

    res.status(200).json({
      message: 'Pago confirmado correctamente.',
      pedidoId: pedido.id,
      estadoPago: nuevoEstado,
      transaccion: {
        transactionId: payphoneData.transactionId,
        transactionStatus: payphoneData.transactionStatus,
        statusCode: payphoneData.statusCode,
        authorizationCode: payphoneData.authorizationCode
      }
    });

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // No hacer nada
    }

    console.error(
      'Error confirmando pago Payphone:',
      error
    );

    res.status(500).json({
      error: 'Error confirmando el pago.',
      details:
        error instanceof Error
          ? error.message
          : error
    });

  } finally {
    client.release();
  }
};