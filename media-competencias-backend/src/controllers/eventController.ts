import { Request, Response } from 'express';
import { query } from '../db'; // Ajusta la ruta a tu archivo db según corresponda

// 1. Obtener todos los eventos activos (Para el Home)
export const getActiveEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT id, nombre, fecha, lugar, activo FROM eventos WHERE activo = true ORDER BY fecha ASC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener los eventos',
      details: error instanceof Error ? error.message : error
    });
  }
};

export const getEventWithParticipants = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params;

  try {
    // 1. Datos generales del Evento
    const eventPromise = query(
      'SELECT id, nombre, fecha, lugar, activo FROM eventos WHERE id = $1',
      [eventId]
    );

    // 2. Participantes con su Categoría y Academia
    // Usamos COALESCE / NULLIF para prevenir errores si algún participante aún no tiene academia o dorsal
    const participantsPromise = query(
      `SELECT 
        p.id, 
        p.nombre_completo, 
        p.dorsal_numero, 
        p.academia,
        c.id AS categoria_id,
        c.nombre_categoria,
        c.tipo_categoria
       FROM participantes p
       INNER JOIN categorias c ON p.categoria_id = c.id
       WHERE c.evento_id = $1
       ORDER BY p.dorsal_numero ASC`,
      [eventId]
    );

    // 3. Paquetes asociados al evento
    const packagesPromise = query(
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
      [eventId]
    );

    const [eventResult, participantsResult, packagesResult] = await Promise.all([
      eventPromise,
      participantsPromise,
      packagesPromise
    ]);

    // Validar si el evento existe
    if (eventResult.rows.length === 0) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }

    // Respuesta estructurada para el frontend
    res.json({
      evento: eventResult.rows[0],
      participantes: participantsResult.rows,
      paquetes: packagesResult.rows
    });
  } catch (error) {
    console.error('Error detallado en getEventWithParticipants:', error);
    res.status(500).json({
      error: 'Error al obtener la información del evento',
      detalles: error instanceof Error ? error.message : error
    });
  }
};

// 3. Obtener solo las categorías y paquetes de un evento específico (Útil para el Checkout)
export const getEventDetails = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params;

  try {
    const categoriesPromise = query(
      'SELECT id, nombre_categoria FROM categorias WHERE evento_id = $1',
      [eventId]
    );

    const packagesPromise = query(
      'SELECT id, nombre_paquete, descripcion, precio, tipo FROM paquetes WHERE evento_id = $1',
      [eventId]
    );

    const [categories, packages] = await Promise.all([categoriesPromise, packagesPromise]);

    res.json({
      categorias: categories.rows,
      paquetes: packages.rows
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener los detalles del evento',
      details: error instanceof Error ? error.message : error
    });
  }
};

// 4. Buscar participantes dentro de una categoría
export const searchParticipants = async (req: Request, res: Response): Promise<void> => {
  const { categoriaId } = req.params;
  const { q } = req.query;

  if (!q) {
    res.status(400).json({ error: 'Falta el parámetro de búsqueda "q"' });
    return;
  }

  try {
    const searchTerm = `%${q}%`;
    const result = await query(
      `SELECT id, nombre_completo, dorsal_numero 
       FROM participantes 
       WHERE categoria_id = $1 
         AND (nombre_completo ILIKE $2 OR dorsal_numero LIKE $3)
       LIMIT 15`,
      [categoriaId, searchTerm, searchTerm]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: 'Error al buscar participantes',
      details: error instanceof Error ? error.message : error
    });
  }
};

// controllers/eventosController.ts
export const getParticipantPackagesDetails = async (req: Request, res: Response): Promise<void> => {
  const { eventId, participantId } = req.params;

  try {
    // 1. Obtener datos del Evento
    const eventQuery = query('SELECT id, nombre, fecha, lugar FROM eventos WHERE id = $1', [eventId]);

    // 2. Obtener datos del Participante + Categoria
    const participantQuery = query(
      `
      SELECT
        p.id,
        p.nombre_completo,
        p.dorsal_numero,
        p.academia,
        c.nombre_categoria,
        c.tipo_categoria
      FROM participantes p
      INNER JOIN categorias c
        ON p.categoria_id = c.id
      WHERE p.id = $1
        AND c.evento_id = $2
      `,
      [participantId, eventId]
    );

    // 3. Obtener Paquetes disponibles para este evento
    const packagesQuery = query(
      `
      SELECT
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
      ORDER BY precio ASC
      `,
      [eventId]
    );

    const [eventRes, partRes, packRes] = await Promise.all([eventQuery, participantQuery, packagesQuery]);

    if (eventRes.rows.length === 0 || partRes.rows.length === 0) {
      res.status(404).json({ error: 'Evento o participante no encontrado' });
      return;
    }

    res.json({
      evento: eventRes.rows[0],
      participante: partRes.rows[0],
      paquetes: packRes.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener detalles' });
  }
};

export const getEventCategories = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params;

  try {
    const result = await query(
      `SELECT id, nombre_categoria, tipo_categoria, orden_categoria
       FROM categorias 
       WHERE evento_id = $1 
       ORDER BY orden_categoria ASC`,
      [eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías del evento:', error);
    res.status(500).json({ error: 'Error al consultar las categorías en la base de datos' });
  }
};