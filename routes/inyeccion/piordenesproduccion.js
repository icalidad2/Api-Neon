import express from "express";
import { pool } from "#db";  // 👈 sube dos niveles desde /routes/produccion

const router = express.Router();

// ======================================================
// 🧭 Normalizador de campos (Google Sheets → SQL fields)
// ======================================================
function normalizarClaves(obj) {
  const map = {
    "id_orden": "id_orden",
    "fecha_de_emision": "fecha_emision",
    "fecha_emision": "fecha_emision",
    "fecha_de_inicio": "fecha_inicio",
    "fecha_inicio": "fecha_inicio",
    "producto_a_fabricar": "producto",
    "producto": "producto",
    "maquina": "maquina",
    "cantidad_solicitada": "cantidad_solicitada",
    "cantidad_fabricada": "cantidad_fabricada", // no se guarda, pero se acepta
    "unidad": "unidad",
    "prioridad": "prioridad",
    "fecha_requerida": "fecha_requerida",
    "fecha_de_cierre": "fecha_cierre",
    "fecha_cierre": "fecha_cierre",
    "qr_info": "qr_info",
    "qr_url": "qr_url",
    "responsable_de_produccion": "responsable",
    "responsable": "responsable",
    "notas": "notas",
    "estado": "estado",
    "cerrar_orden": "cerrar_orden",
    "suspender_orden": "suspender_orden"
  };

  const nuevo = {};
  for (let key in obj) {
    const limpio = key.trim().toLowerCase().replace(/\s+/g, "_");
    nuevo[map[limpio] || limpio] = obj[key];
  }
  return nuevo;
}

// ======================================================
// 🚀 Endpoint: /sync_piordenesproduccion
// ======================================================
router.post("/sync_piordenesproduccion", async (req, res) => {
  try {
    const o = normalizarClaves(req.body);
    console.log("📦 Datos recibidos y normalizados:", o);

    // 🔹 Validaciones mínimas
    if (!o.id_orden) {
      return res.status(400).json({ ok: false, mensaje: "❌ Falta id_orden" });
    }

    const cantidadSolicitada = parseFloat(o.cantidad_solicitada || 0);
    if (isNaN(cantidadSolicitada) || cantidadSolicitada <= 0) {
      return res.status(400).json({ ok: false, mensaje: "⚠️ cantidad_solicitada inválida" });
    }

    // 🔹 Preparar valores (ignoramos columnas que no existen)
    const valores = [
      o.id_orden,
      o.fecha_emision || null,
      o.fecha_inicio || null,
      o.producto || null,
      o.maquina || null,
      cantidadSolicitada,
      o.unidad || null,
      o.prioridad || null,
      o.fecha_requerida || null,
      o.fecha_cierre || null,
      o.qr_info || null,
      o.qr_url || null,
      o.responsable || null,
      o.notas || null
    ];

    // ======================================================
    // 💾 Inserción o actualización idempotente
    // ======================================================
    await pool.query(
      `INSERT INTO piordenesproduccion (
        id_orden, fecha_emision, fecha_inicio, producto, maquina,
        cantidad_solicitada, unidad, prioridad, fecha_requerida,
        fecha_cierre, qr_info, qr_url, responsable, notas
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
      )
      ON CONFLICT (id_orden)
      DO UPDATE SET
        fecha_emision = EXCLUDED.fecha_emision,
        fecha_inicio = EXCLUDED.fecha_inicio,
        producto = EXCLUDED.producto,
        maquina = EXCLUDED.maquina,
        cantidad_solicitada = EXCLUDED.cantidad_solicitada,
        unidad = EXCLUDED.unidad,
        prioridad = EXCLUDED.prioridad,
        fecha_requerida = EXCLUDED.fecha_requerida,
        fecha_cierre = EXCLUDED.fecha_cierre,
        qr_info = EXCLUDED.qr_info,
        qr_url = EXCLUDED.qr_url,
        responsable = EXCLUDED.responsable,
        notas = EXCLUDED.notas;`,
      valores
    );

    res.json({
      ok: true,
      mensaje: `✅ Orden PI ${o.id_orden} sincronizada correctamente en Neon.`,
    });
  } catch (err) {
    console.error("❌ Error en inserción de piordenesproduccion:", err);
    res.status(500).json({
      ok: false,
      mensaje: "Error al insertar o actualizar orden de producción PI",
      error: err.message || "Sin mensaje de error",
    });
  }
});

export default router;
