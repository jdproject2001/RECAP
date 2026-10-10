import { Router } from "express";
import pool from "../db";
import {
  authenticateFirebase,
  AuthenticatedRequest
} from "../middleware/authMiddleware";

const router = Router();

router.post(
  "/sync",
  authenticateFirebase,
  async (req: AuthenticatedRequest, res) => {
    const client = await pool.connect();

    try {
      const firebaseUid = req.firebaseUser?.uid;
      const firebaseEmail = req.firebaseUser?.email;
      const { email: bodyEmail, displayName } = req.body;

      if (!firebaseUid) {
        return res.status(401).json({
          error: "Usuario de Firebase no identificado"
        });
      }

      /*
       * Preferimos el email verificado por Firebase.
       * El body queda solamente como respaldo.
       */
      const email = (
        firebaseEmail ||
        bodyEmail ||
        ""
      )
        .trim()
        .toLowerCase();

      if (!email) {
        return res.status(400).json({
          error: "El correo electrónico es obligatorio"
        });
      }

      // Separar nombre y apellido
      const nameParts = (displayName || "").trim().split(/\s+/);
      const nombre = nameParts[0] || "";
      const apellido = nameParts.slice(1).join(" ") || "";

      await client.query("BEGIN");

      // =====================================================
      // 1. Buscar por Firebase UID
      // =====================================================
      const userByFirebase = await client.query(
        `
        SELECT
          id,
          firebase_uid,
          email,
          nombre,
          apellido,
          celular,
          fecha_creacion
        FROM usuarios
        WHERE firebase_uid = $1
        LIMIT 1
        `,
        [firebaseUid]
      );

      // =====================================================
      // 2. Buscar por email
      // =====================================================
      const userByEmail = await client.query(
        `
        SELECT
          id,
          firebase_uid,
          email,
          nombre,
          apellido,
          celular,
          fecha_creacion
        FROM usuarios
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        `,
        [email]
      );

      let userResult;

      // =====================================================
      // CASO 1:
      // Existe por Firebase UID
      // =====================================================
      if (userByFirebase.rows.length > 0) {
        const firebaseUser = userByFirebase.rows[0];

        /*
         * Caso importante:
         *
         * Existe por UID y además el email existe,
         * pero pertenecen a usuarios distintos.
         *
         * NO intentamos fusionarlos automáticamente.
         */
        if (
          userByEmail.rows.length > 0 &&
          userByEmail.rows[0].id !== firebaseUser.id
        ) {
          await client.query("ROLLBACK");

          console.error("Conflicto de usuario:", {
            firebaseUid,
            email,
            usuarioPorUid: firebaseUser.id,
            usuarioPorEmail: userByEmail.rows[0].id
          });

          return res.status(409).json({
            error: "Existe otro usuario registrado con este correo electrónico."
          });
        }

        // Es el mismo usuario
        userResult = await client.query(
          `
          UPDATE usuarios
          SET
            email = $1,
            nombre = $2,
            apellido = $3
          WHERE id = $4
          RETURNING
            id,
            firebase_uid,
            email,
            nombre,
            apellido,
            celular,
            fecha_creacion
          `,
          [email, nombre, apellido, firebaseUser.id]
        );
      }

      // =====================================================
      // CASO 2:
      // No existe UID, pero existe email
      // =====================================================
      else if (userByEmail.rows.length > 0) {
        const existingUser = userByEmail.rows[0];

        /*
         * Si ya tiene OTRO Firebase UID,
         * no debemos sobreescribirlo silenciosamente.
         */
        if (
          existingUser.firebase_uid &&
          existingUser.firebase_uid !== firebaseUid
        ) {
          await client.query("ROLLBACK");

          console.error("Email asociado a otro Firebase UID:", {
            email,
            firebaseUidNuevo: firebaseUid,
            firebaseUidExistente: existingUser.firebase_uid,
            usuarioId: existingUser.id
          });

          return res.status(409).json({
            error: "Este correo ya está asociado a otra cuenta de autenticación."
          });
        }

        /*
         * Usuario antiguo existente por correo,
         * pero todavía sin Firebase UID.
         *
         * Lo vinculamos.
         */
        userResult = await client.query(
          `
          UPDATE usuarios
          SET
            firebase_uid = $1,
            nombre = $2,
            apellido = $3
          WHERE id = $4
          RETURNING
            id,
            firebase_uid,
            email,
            nombre,
            apellido,
            celular,
            fecha_creacion
          `,
          [firebaseUid, nombre, apellido, existingUser.id]
        );
      }

      // =====================================================
      // CASO 3:
      // Usuario completamente nuevo
      // =====================================================
      else {
        userResult = await client.query(
          `
          INSERT INTO usuarios (
            firebase_uid,
            email,
            nombre,
            apellido
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            firebase_uid,
            email,
            nombre,
            apellido,
            celular,
            fecha_creacion
          `,
          [firebaseUid, email, nombre, apellido]
        );
      }

      const usuario = userResult.rows[0];

      // =====================================================
      // 3. Verificar roles
      // =====================================================
      const rolesResult = await client.query(
        `
        SELECT
          r.id,
          r.nombre_rol
        FROM usuario_roles ur
        INNER JOIN roles r
          ON r.id = ur.rol_id
        WHERE ur.usuario_id = $1
        ORDER BY r.id
        `,
        [usuario.id]
      );

      let roles = rolesResult.rows.map(row => row.nombre_rol);

      // =====================================================
      // 4. Si no tiene ningún rol, asignar CLIENTE
      // =====================================================
      if (roles.length === 0) {
        const clienteRoleResult = await client.query(
          `
          SELECT id
          FROM roles
          WHERE LOWER(nombre_rol) = 'cliente'
          LIMIT 1
          `
        );

        if (clienteRoleResult.rows.length === 0) {
          throw new Error('No existe el rol "cliente" en la tabla roles.');
        }

        const clienteRolId = clienteRoleResult.rows[0].id;

        /*
         * Evitamos duplicar la relación aunque
         * usuario_roles no tenga UNIQUE.
         */
        await client.query(
          `
          INSERT INTO usuario_roles (
            usuario_id,
            rol_id
          )
          SELECT $1, $2
          WHERE NOT EXISTS (
            SELECT 1
            FROM usuario_roles
            WHERE usuario_id = $1
              AND rol_id = $2
          )
          `,
          [usuario.id, clienteRolId]
        );

        roles = ["cliente"];
      }

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Usuario sincronizado con éxito",
        usuario: {
          ...usuario,
          roles
        }
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Error al sincronizar usuario:", error);

      return res.status(500).json({
        error: "Error interno del servidor"
      });
    } finally {
      client.release();
    }
  }
);

export default router;