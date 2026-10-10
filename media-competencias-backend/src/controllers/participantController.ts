import { Request, Response } from 'express';
import { query } from '../db'; // Ajusta esta importación según la ruta de tu conexión PostgreSQL

export const createParticipant = async (req: Request, res: Response): Promise<void> => {
  const { categoria_id, nombre_completo, dorsal_numero, academia } = req.body;

  if (!categoria_id || !nombre_completo) {
    res.status(400).json({ error: 'La categoría y el nombre del participante son requeridos' });
    return;
  }

  try {
    const queryText = `
      INSERT INTO participantes (categoria_id, nombre_completo, dorsal_numero, academia)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query(queryText, [
      categoria_id,
      nombre_completo,
      dorsal_numero || null,
      academia || null
    ]);

    res.status(201).json({
      mensaje: 'Participante registrado exitosamente',
      participante: result.rows[0]
    });
  } catch (error) {
    console.error('Error al insertar participante:', error);
    res.status(500).json({
      error: 'Error interno del servidor al crear participante',
      details: error instanceof Error ? error.message : error
    });
  }
};

// GET /api/v1/participantes/:participantId
export const getParticipantWithPackages = async (req: Request, res: Response): Promise<void> => {
  const { participantId } = req.params;

  try {
    // 1. Obtener datos del participante + evento + categoría
    const participantResult = await query(
      `SELECT 
        p.id AS participante_id,
        p.nombre_completo,
        p.dorsal_numero,
        p.academia,
        c.nombre_categoria,
        c.tipo_categoria,
        e.id AS evento_id,
        e.nombre AS nombre_evento
       FROM participantes p
       INNER JOIN categorias c ON p.categoria_id = c.id
       INNER JOIN eventos e ON c.evento_id = e.id
       WHERE p.id = $1`,
      [participantId]
    );

    if (participantResult.rows.length === 0) {
      res.status(404).json({ error: 'Participante no encontrado' });
      return;
    }

    const participante = participantResult.rows[0];

    // 2. Obtener paquetes del evento correspondiente
    const packagesResult = await query(
      `SELECT
        id,
        evento_id,
        nombre_paquete,
        descripcion,
        precio,
        tipo,
        modalidad,
        cantidad_fotos,
        tipo_formato
      FROM paquetes
      WHERE evento_id = $1
      ORDER BY precio ASC`,
      [participante.evento_id]
    );

    res.json({
      participante,
      paquetes: packagesResult.rows
    });
  } catch (error) {
    console.error('Error al obtener detalle del participante:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};