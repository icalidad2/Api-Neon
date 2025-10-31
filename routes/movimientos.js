import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.post("/sync_movimiento", async (req, res) => {
  try {
    const m = req.body;
    console.log("📦 Datos recibidos:", m);

    // ✅ Validaciones con nombres SQL correctos
    if (!m.id_movimiento) {
      return res.status(400).json({ ok: false, mensaje: "❌ Falta id_movimiento" });
    }
    if (!m.tipo_movimiento) {
      return res.status(400).json({ ok: false, mensaje: "❌ Falta tipo_movimiento" });
    }

    const cantidad = parseFloat(m.cantidad || 0);
    if (isNaN(cantidad) || cantidad <= 0) {
      return res.status(400).json({ ok: false, mensaje: "⚠️ cantidad inválida" });
    }

    // 🔹 Insertar en base de datos
    await pool.query(
      `INSERT INTO movimientos (
        id_movimiento, tipo_movimiento, cantidad, producto, fecha_hora
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [m.id_movimiento, m.tipo_movimiento, cantidad, m.producto]
    );

    res.json({
      ok: true,
      mensaje: `✅ Movimiento ${m.id_movimiento} insertado correctamente en Neon.`,
    });
  } catch (err) {
    console.error("❌ Error completo en inserción:", err);
    res.status(500).json({
      ok: false,
      mensaje: "Error al insertar en Neon",
      error: err.message || "Sin mensaje de error",
    });
  }
});

export default router;
