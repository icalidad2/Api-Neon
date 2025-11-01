import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ======================================================
// 🧭 Normalizador de claves (de hoja a SQL)
// ======================================================
function normalizarClaves(obj) {
  const map = {
    "id_registro": "id_registro",
    "id_op": "id_op",
    "fecha_y_hora": "fecha_hora",
    "fecha_hora": "fecha_hora",
    "producto": "producto",
    "color": "color",
    "turno": "turno",
    "cantidad": "cantidad",
    "lote": "lote",
    "operador": "operador",
    "supervisor": "supervisor"
  };

  const nuevo = {};
  for (let key in obj) {
    const limpio = key.trim().toLowerCase().replace(/\s+/g, "_");
    nuevo[map[limpio] || limpio] = obj[key];
  }
  return nuevo;
}

// ======================================================
// 🚀 Endpoint: /sync_produccionpi
// ======================================================
router.post("/sync_produccionpi", async (req, res) => {
  try {
    const p = normalizarClaves(req.body);
    console.log("📦 Datos recibidos y normalizados:", p);

    // 🔹 Validación mínima
    if (!p.id_registro) {
      return res.status(400).json({ ok: false, mensaje: "❌ Falta id_registro" });
    }

    const cantidad = parseFloat(p.cantidad || 0);
    if (isNaN(cantidad) || cantidad < 0) {
      return res.status(400).json({ ok: false, mensaje: "⚠️ cantidad inválida" });
    }

    // 🔹 Preparar valores
    const valores = [
      p.id_registro,
      p.id_op || null,
      p.fecha_hora || null,
      p.producto || null,
      p.color || null,
      p.turno || null,
      cantidad,
      p.lote || null,
      p.operador || null,
      p.supervisor || null
    ];

    // ======================================================
    // 💾 Inserción / actualización automática
    // ======================================================
    await pool.query(
      `INSERT INTO produccionpi (
        id_registro, id_op, fecha_hora, producto, color,
        turno, cantidad, lote, operador, supervisor
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id_registro)
      DO UPDATE SET
        id_op = EXCLUDED.id_op,
        fecha_hora = EXCLUDED.fecha_hora,
        producto = EXCLUDED.producto,
        color = EXCLUDED.color,
        turno = EXCLUDED.turno,
        cantidad = EXCLUDED.cantidad,
        lote = EXCLUDED.lote,
        operador = EXCLUDED.operador,
        supervisor = EXCLUDED.supervisor;`,
      valores
    );

    res.json({
      ok: true,
      mensaje: `✅ Registro de producción ${p.id_registro} sincronizado correctamente en Neon.`,
    });
  } catch (err) {
    console.error("❌ Error en inserción de ProduccionPI:", err);
    res.status(500).json({
      ok: false,
      mensaje: "Error al insertar o actualizar registro de Producción",
      error: err.message || "Sin mensaje de error",
    });
  }
});

export default router;