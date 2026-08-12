// routes/auth.routes.js
import { Router } from "express";
import pool from "../db";

const router = Router();

router.post("/sync", async (req, res) => {
  try {
    const { uid, email, displayName } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // Separar el displayName de Google en Nombre y Apellido
    const nameParts = (displayName || "").trim().split(" ");
    const nombre = nameParts[0] || "";
    const apellido = nameParts.slice(1).join(" ") || "";

    const query = `
      INSERT INTO usuarios (firebase_uid, email, nombre, apellido)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (firebase_uid) 
      DO UPDATE SET 
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido
      RETURNING id, firebase_uid, email, nombre, apellido, celular, rol;
    `;

    const values = [uid, email, nombre, apellido];
    const result = await pool.query(query, values);

    return res.status(200).json({
      message: "Usuario sincronizado con éxito",
      usuario: result.rows[0],
    });
  } catch (error) {
    console.error("Error al sincronizar usuario:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});