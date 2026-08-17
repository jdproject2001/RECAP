import { Router } from "express";
import pool from "../db";
import { authenticateFirebase, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/sync",
  authenticateFirebase,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { email, displayName } = req.body;

      const firebaseUid = req.firebaseUser?.uid;

      if (!firebaseUid) {
        return res.status(401).json({
          error: "Usuario de Firebase no identificado"
        });
      }

      if (!email) {
        return res.status(400).json({
          error: "El correo electrónico es obligatorio"
        });
      }

      // Separar nombre y apellido
      const nameParts = (displayName || "").trim().split(/\s+/);

      const nombre = nameParts[0] || "";
      const apellido = nameParts.slice(1).join(" ") || "";

      // Crear o actualizar el usuario
      const userQuery = `
        INSERT INTO usuarios (
          firebase_uid,
          email,
          nombre,
          apellido
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET
          email = EXCLUDED.email,
          nombre = EXCLUDED.nombre,
          apellido = EXCLUDED.apellido
        RETURNING
          id,
          firebase_uid,
          email,
          nombre,
          apellido,
          celular,
          fecha_creacion;
      `;

      const userResult = await pool.query(userQuery, [
        firebaseUid,
        email,
        nombre,
        apellido
      ]);

      const usuario = userResult.rows[0];

      // Obtener los roles del usuario
      const rolesQuery = `
        SELECT r.nombre_rol
        FROM usuario_roles ur
        INNER JOIN roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = $1
        ORDER BY r.id;
      `;

      const rolesResult = await pool.query(rolesQuery, [usuario.id]);

      const roles = rolesResult.rows.map(
        (row) => row.nombre_rol
      );

      return res.status(200).json({
        message: "Usuario sincronizado con éxito",
        usuario: {
          ...usuario,
          roles
        }
      });

    } catch (error) {
      console.error("Error al sincronizar usuario:", error);

      return res.status(500).json({
        error: "Error interno del servidor"
      });
    }
  }
);

export default router;