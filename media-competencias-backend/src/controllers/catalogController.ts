import { Request, Response } from 'express';
import { query } from '../db';

// 1. Obtener todos los eventos activos
export const getActiveEvents = async (req: Request, res: Response) => {
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

// 2. Obtener las categorías y paquetes de un evento específico
export const getEventDetails = async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    // Obtenemos categorías
    const categoriesPromise = query(
      'SELECT id, nombre_categoria FROM categorias WHERE evento_id = $1',
      [eventId]
    );

    // Obtenemos paquetes comerciales disponibles para este evento
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

// 3. Buscar participantes dentro de una categoría por nombre o número de dorsal
export const searchParticipants = async (req: Request, res: Response) => {
  const { categoriaId } = req.params;
  const { q } = req.query; // El término de búsqueda (ej: ?q=104 o ?q=Danna)

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