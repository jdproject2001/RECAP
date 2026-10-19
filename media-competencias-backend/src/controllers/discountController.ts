import { Request, Response } from 'express';
import pool from '../db';

export const validateDiscount = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { codigo, items } = req.body;

  if (
    !codigo ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    res.status(400).json({
      valido: false,
      error: 'Debes enviar un código y al menos un item.'
    });
    return;
  }

  const client = await pool.connect();

  try {
    const codigoNormalizado = codigo
      .toString()
      .trim()
      .toUpperCase();

    // =====================================================
    // 1. Buscar descuento
    // =====================================================
    const descuentoResult = await client.query(
      `
      SELECT
        id,
        codigo,
        evento_id,
        academia,
        tipo,
        valor,
        minimo_items,
        tipo_paquete,
        activo,
        fecha_inicio,
        fecha_fin
      FROM descuentos
      WHERE UPPER(codigo) = $1
      LIMIT 1
      `,
      [codigoNormalizado]
    );

    if (descuentoResult.rows.length === 0) {
      res.status(404).json({
        valido: false,
        error: 'El código de descuento no existe.'
      });
      return;
    }

    const descuento = descuentoResult.rows[0];

    // =====================================================
    // 2. Validar activo
    // =====================================================
    if (!descuento.activo) {
      res.status(400).json({
        valido: false,
        error: 'El código de descuento no está activo.'
      });
      return;
    }

    // =====================================================
    // 3. Validar fechas
    // =====================================================
    const ahora = new Date();

    if (
      descuento.fecha_inicio &&
      ahora < new Date(descuento.fecha_inicio)
    ) {
      res.status(400).json({
        valido: false,
        error: 'El código de descuento todavía no está disponible.'
      });
      return;
    }

    if (
      descuento.fecha_fin &&
      ahora > new Date(descuento.fecha_fin)
    ) {
      res.status(400).json({
        valido: false,
        error: 'El código de descuento ha expirado.'
      });
      return;
    }

    // =====================================================
    // 4. Validar mínimo de items
    // =====================================================
    const minimoItems = Number(
      descuento.minimo_items || 1
    );

    if (items.length < minimoItems) {
      res.status(400).json({
        valido: false,
        error: `Este descuento requiere al menos ${minimoItems} participantes.`
      });
      return;
    }

    // =====================================================
    // 5. Procesar carrito
    // =====================================================
    let subtotal = 0;

    for (const item of items) {
      const { paquete_id, participante_id } = item;

      if (!paquete_id || !participante_id) {
        res.status(400).json({
          valido: false,
          error: 'Uno de los items del carrito es inválido.'
        });
        return;
      }

      // -----------------------------------------------------
      // Obtener paquete
      // -----------------------------------------------------
      const paqueteResult = await client.query(
        `
        SELECT
          id,
          evento_id,
          nombre_paquete,
          precio,
          tipo
        FROM paquetes
        WHERE id = $1
        `,
        [paquete_id]
      );

      if (paqueteResult.rows.length === 0) {
        res.status(400).json({
          valido: false,
          error: 'Uno de los paquetes no existe.'
        });
        return;
      }

      const paquete = paqueteResult.rows[0];

      // -----------------------------------------------------
      // Obtener participante
      // -----------------------------------------------------
      const participanteResult = await client.query(
        `
        SELECT
          p.id,
          p.academia,
          c.evento_id
        FROM participantes p
        INNER JOIN categorias c
          ON c.id = p.categoria_id
        WHERE p.id = $1
        `,
        [participante_id]
      );

      if (participanteResult.rows.length === 0) {
        res.status(400).json({
          valido: false,
          error: 'Uno de los participantes no existe.'
        });
        return;
      }

      const participante = participanteResult.rows[0];

      // =====================================================
      // 6. Validar mismo evento
      // =====================================================
      if (paquete.evento_id !== participante.evento_id) {
        res.status(400).json({
          valido: false,
          error: 'Uno de los paquetes no corresponde al participante.'
        });
        return;
      }

      // =====================================================
      // 7. Validar evento del descuento
      // =====================================================
      if (paquete.evento_id !== descuento.evento_id) {
        res.status(400).json({
          valido: false,
          error: 'El código de descuento no corresponde a este evento.'
        });
        return;
      }

      // =====================================================
      // 8. Validar academia
      // =====================================================
      if (descuento.academia) {
        const academiaParticipante = participante.academia
          ?.trim()
          .toLowerCase();

        const academiaDescuento = descuento.academia
          .trim()
          .toLowerCase();

        if (academiaParticipante !== academiaDescuento) {
          res.status(400).json({
            valido: false,
            error: 'El código de descuento solo es válido para la academia configurada.'
          });
          return;
        }
      }

      // =====================================================
      // 9. Validar tipo de paquete
      // =====================================================
      const tipoDescuento = descuento.tipo_paquete
        ?.toString()
        .trim()
        .toUpperCase();

      const tipoPaquete = paquete.tipo
        ?.toString()
        .trim()
        .toUpperCase();

      if (
        tipoDescuento !== 'TODOS' &&
        tipoDescuento !== tipoPaquete
      ) {
        res.status(400).json({
          valido: false,
          error: 'El código de descuento no aplica para uno de los paquetes seleccionados.'
        });
        return;
      }

      // =====================================================
      // 10. Sumar precio real
      // =====================================================
      const precio = Number(paquete.precio);

      if (!Number.isFinite(precio) || precio < 0) {
        res.status(400).json({
          valido: false,
          error: 'Uno de los paquetes tiene un precio inválido.'
        });
        return;
      }

      subtotal += precio;
    }

    // =====================================================
    // 11. Calcular descuento
    // =====================================================
    const valor = Number(descuento.valor);
    let descuentoMonto = 0;

    if (descuento.tipo === 'PORCENTAJE') {
      if (valor < 0 || valor > 100) {
        res.status(400).json({
          valido: false,
          error: 'El porcentaje del descuento es inválido.'
        });
        return;
      }

      descuentoMonto = subtotal * (valor / 100);
    } else if (descuento.tipo === 'FIJO') {
      descuentoMonto = valor;
    } else {
      res.status(400).json({
        valido: false,
        error: 'El tipo de descuento es inválido.'
      });
      return;
    }

    descuentoMonto = Math.min(descuentoMonto, subtotal);
    descuentoMonto = Math.round(descuentoMonto * 100) / 100;

    const total = Math.round(
      (subtotal - descuentoMonto) * 100
    ) / 100;

    // =====================================================
    // 12. Respuesta
    // =====================================================
    res.status(200).json({
      valido: true,
      codigo: descuento.codigo,
      tipo: descuento.tipo,
      valor: Number(descuento.valor),
      subtotal: Math.round(subtotal * 100) / 100,
      descuento: descuentoMonto,
      total
    });
  } catch (error) {
    console.error('Error validando descuento:', error);

    res.status(500).json({
      valido: false,
      error: 'Error al validar el código de descuento.'
    });
  } finally {
    client.release();
  }
};