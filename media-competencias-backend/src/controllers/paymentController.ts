import { Request, Response } from 'express';
import pool, { query } from '../db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// 1. Iniciar Sesión de Pago (Request Session)
export const initiatePayment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {

  const { pedidoId } = req.body;

  if (!pedidoId) {
    res.status(400).json({ error: 'Se requiere el pedidoId para iniciar el pago.' });
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
    // Consultar el pedido en la BD
    const pedidoQuery = await query(
      `
    SELECT p.id, p.monto_total, p.estado_pago
    FROM pedidos p
    INNER JOIN usuarios u ON u.id = p.usuario_id
    WHERE p.id = $1
      AND u.firebase_uid = $2
    `,
      [pedidoId, firebaseUid]
    );

    if (pedidoQuery.rows.length === 0) {
      res.status(404).json({ error: 'Pedido no encontrado.' });
      return;
    }

    const pedido = pedidoQuery.rows[0];

    if (pedido.estado_pago !== 'pendiente') {
      res.status(400).json({ error: 'Este pedido ya fue procesado o cancelado.' });
      return;
    }

    const paymentMode = process.env.PAYMENT_MODE || 'mock';

    if (paymentMode === 'mock') {
      // --- MODO SIMULADO ---
      const mockSessionId = `mock_session_${Date.now()}`;
      // Generamos una URL de nuestro propio backend que simulará ser el checkout de Placetopay
      const mockProcessUrl = `${process.env.API_BASE_URL}/api/v1/payments/mock-gateway/${pedido.id}/${mockSessionId}`;

      // Guardamos la sesión simulada en el pedido
      await query(
        'UPDATE pedidos SET placetopay_session_id = $1 WHERE id = $2',
        [mockSessionId, pedido.id]
      );

      res.json({
        message: 'Sesión de pago simulada creada',
        processUrl: mockProcessUrl, // El frontend debe redirigir aquí
        sessionId: mockSessionId
      });
      return;
    } 
      // --- MODO REAL (Para cuando tengas las credenciales) ---
      // Aquí irá la petición fetch/axios real hacia Placetopay usando generateAuth()
    res.status(501).json({
      error: 'Integración real de Placetopay no configurada aún.'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Error al iniciar el pago',
      details: error instanceof Error ? error.message : error
    });
  }
};

// 2. Pasarela Simulada (Vista HTML interactiva)
// Esto simula la pantalla de Placetopay en el navegador para que puedas hacer click en "Aprobar" o "Rechazar"
export const renderMockGateway = async (req: Request, res: Response): Promise<void> => {
  const { pedidoId, sessionId } = req.params;

  try {
    const pedidoQuery = await query('SELECT monto_total FROM pedidos WHERE id = $1', [pedidoId]);
    if (pedidoQuery.rows.length === 0) {
      res.status(404).send('Pedido no encontrado');
      return;
    }

    const monto = pedidoQuery.rows[0].monto_total;

    // Retornamos un HTML interactivo súper básico directamente desde Express
    res.send(`
      <html>
        <head>
          <title>Simulador de Placetopay</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; }
            .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 350px; text-align: center; }
            button { width: 100%; padding: 12px; margin: 8px 0; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
            .btn-success { background: #10b981; color: white; }
            .btn-danger { background: #ef4444; color: white; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Simulador Placetopay</h2>
            <p><strong>Pedido ID:</strong> ${pedidoId}</p>
            <p style="font-size: 24px; font-weight: bold; color: #1e3a8a;">$${monto} USD</p>
            <p>Selecciona el resultado de la transacción:</p>
            
            <form action="/api/v1/payments/mock-webhook" method="POST">
              <input type="hidden" name="pedidoId" value="${pedidoId}" />
              <input type="hidden" name="sessionId" value="${sessionId}" />
              <input type="hidden" name="status" value="APPROVED" />
              <button type="submit" class="btn-success">Simular Pago Exitoso</button>
            </form>

            <form action="/api/v1/payments/mock-webhook" method="POST">
              <input type="hidden" name="pedidoId" value="${pedidoId}" />
              <input type="hidden" name="sessionId" value="${sessionId}" />
              <input type="hidden" name="status" value="REJECTED" />
              <button type="submit" class="btn-danger">Simular Pago Fallido</button>
            </form>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error interno en el simulador');
  }
};

// 3. Webhook del Simulador
// Recibe la confirmación del HTML anterior, procesa la transacción SQL y redirige al frontend
export const handleMockWebhook = async (req: Request, res: Response): Promise<void> => {
  const { pedidoId, sessionId, status } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const nuevoEstado = status === 'APPROVED' ? 'aprobado' : 'fallido';

    // 1. Actualizamos el estado del pedido
    await client.query(
      'UPDATE pedidos SET estado_pago = $1 WHERE id = $2 AND placetopay_session_id = $3',
      [nuevoEstado, pedidoId, sessionId]
    );

    // 2. Si el pago fue aprobado, activamos el workflow para la Fase 2 (tracking técnico)
    if (nuevoEstado === 'aprobado') {
      // Buscamos los ítems del pedido
      const itemsQuery = await client.query('SELECT id FROM pedido_items WHERE pedido_id = $1', [pedidoId]);

      // Creamos su fila de tracking técnico inicializado en pendiente
      for (const item of itemsQuery.rows) {
        await client.query(
          `INSERT INTO tracking_tecnico (pedido_item_id) 
           VALUES ($1) 
           ON CONFLICT (pedido_item_id) DO NOTHING`,
          [item.id]
        );
      }
    }

    await client.query('COMMIT');

    // Redirigimos al usuario de regreso a la URL de retorno del Frontend pasándole el ID y el estado
    const returnUrl = `${process.env.P2P_RETURN_URL}?pedidoId=${pedidoId}&status=${nuevoEstado}`;
    res.redirect(returnUrl);

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al procesar el webhook simulado.' });
  } finally {
    client.release();
  }
};