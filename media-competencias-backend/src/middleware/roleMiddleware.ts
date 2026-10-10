import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import pool from '../db';

type AllowedRole = 'admin' | 'tecnico' | 'cliente';

export const requireRole = (allowedRoles: AllowedRole[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const firebaseUid = req.firebaseUser?.uid;

      if (!firebaseUid) {
        res.status(401).json({ error: 'Usuario no autenticado.' });
        return;
      }

      const result = await pool.query(
        `
        SELECT
          r.id,
          r.nombre_rol
        FROM usuarios u
        INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
        INNER JOIN roles r ON r.id = ur.rol_id
        WHERE u.firebase_uid = $1
        `,
        [firebaseUid]
      );

      if (result.rows.length === 0) {
        res.status(403).json({ error: 'El usuario no tiene roles asignados.' });
        return;
      }

      const userRoles = result.rows.map(
        row => row.nombre_rol?.toString().trim().toLowerCase()
      );

      const hasPermission = allowedRoles.some(role =>
        userRoles.includes(role.toLowerCase())
      );

      if (!hasPermission) {
        res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
        return;
      }

      next();
    } catch (error) {
      console.error('Error verificando rol:', error);

      res.status(500).json({ error: 'Error verificando permisos del usuario.' });
    }
  };
};