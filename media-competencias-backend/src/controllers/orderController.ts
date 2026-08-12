import { Request, Response } from 'express';
import pool, { query } from '../db';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const { nombre, email, whatsapp, items } = req.body;

  // Validación básica de entrada
  if (!nombre || !email || !whatsapp || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Datos incompletos o formato de carrito inválido.' });
    return;
  }

  // Iniciamos una transacción con el cliente del Pool para asegurar consistencia
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Manejo del Usuario: Buscar o Crear (Frictionless Checkout)
    let userResult = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    let usuarioId: string;

    if (userResult.rows.length > 0) {
      usuarioId = userResult.rows[0].id;
    } else {
      // Si no existe, lo creamos con un hash genérico provisional (o vacío ya que en Fase 1 no hay login obligatorio para comprar)
      const newUser = await client.query(
        `INSERT INTO usuarios (nombre, email, whatsapp, password_hash) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [nombre, email, whatsapp, 'checkout_express_no_pass']
      );
      usuarioId = newUser.rows[0].id;
    }

    // 2. Calcular el Monto Total consultando la Base de Datos
    let montoTotal = 0;
    const itemsProcesados = [];

    for (const item of items) {
      const { paquete_id, participante_id } = item;

      // Consultamos el precio real del paquete en la DB
      const packageCheck = await client.query(
        'SELECT precio, nombre_paquete FROM paquetes WHERE id = $1',
        [paquete_id]
      );

      if (packageCheck.rows.length === 0) {
        throw new Error(`El paquete con ID ${paquete_id} no existe.`);
      }

      const precioReal = parseFloat(packageCheck.rows[0].precio);
      montoTotal += precioReal;

      itemsProcesados.push({
        paquete_id,
        participante_id
      });
    }

    // 3. Insertar el Pedido (en estado PENDIENTE)
    const pedidoResult = await client.query(
      `INSERT INTO pedidos (usuario_id, monto_total, estado_pago) 
       VALUES ($1, $2, 'pendiente') RETURNING id, monto_total, estado_pago`,
      [usuarioId, montoTotal]
    );
    const nuevoPedido = pedidoResult.rows[0];

    // 4. Insertar los ítems asociados al pedido
    for (const item of itemsProcesados) {
      await client.query(
        `INSERT INTO pedido_items (pedido_id, participante_id, paquete_id) 
         VALUES ($1, $2, $3)`,
        [nuevoPedido.id, item.participante_id, item.paquete_id]
      );
    }

    // Confirmamos toda la transacción
    await client.query('COMMIT');

    res.status(201).json({
      message: 'Pedido creado exitosamente en estado PENDIENTE',
      pedido: {
        id: nuevoPedido.id,
        monto_total: nuevoPedido.monto_total,
        estado_pago: nuevoPedido.estado_pago
      }
    });

  } catch (error) {
    // Si algo falla, revertimos todos los cambios para no dejar basura en la DB
    await client.query('ROLLBACK');
    res.status(500).json({
      error: 'Error al procesar el pedido en el servidor',
      details: error instanceof Error ? error.message : error
    });
  } finally {
    // Es vital liberar el cliente de vuelta al pool de conexiones
    client.release();
  }
};