import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ======================================================
// 🧭 Normalizador de campos (Google Sheets → SQL fields)
// ======================================================
function normalizarClaves(obj) {
  const map = {
    "id_inventario": "id_inventario",
    "producto_id": "producto_id",
    "fecha_de_ingreso": "fecha_ingreso",
    "fecha_ingreso": "fecha_ingreso",
    "color/diseño": "color_diseño",
    "color_diseño": "color_diseño",
    "proveedor": "proveedor",
    "lote": "lote",
    "número_de_analisis": "numero_analisis",
    "numero_de_analisis": "numero_analisis",
    "cantidad": "cantidad",
    "factura_/_orden_de_compra": "factura_o_ordendecompra",
    "factura_o_orden_de_compra": "factura_o_ordendecompra",
    "tipo_de_producto": "tipo",
    "tipo": "tipo",
    "estado": "estado",
    "ultimo_movimiento": "utlimo_movimiento",
    "utlimo_movimiento": "utlimo_movimiento",
    "comentarios_de_calidad": "comentario_cc",
    "comentario_cc": "comentario_cc",
    "dictamen_cc": "dictamen_cc"
  };

  const nuevo = {};
  for (let key in obj) {
    const limpio = key.trim().toLowerCase().replace(/\s+/g, "_");
    nuevo[map[limpio] || limpio] = obj[key];
  }
  return nuevo;
}

// ======================================================
// 🚀 Endpoint: /sync_inventario
// ======================================================
router.post("/sync_inventario", async (req, res) => {
  try {
    const m = normalizarClaves(req.body);
    console.log("📦 Datos recibidos y normalizados:", m);

    // 🔹 Validaciones mínimas obligatorias
    if (!m.id_inventario) {
      return res.status(400).json({ ok: false, mensaje: "❌ Falta id_inventario" });
    }

    const cantidad = parseFloat(m.cantidad || 0);
    if (isNaN(cantidad) || cantidad < 0) {
      return res.status(400).json({ ok: false, mensaje: "⚠️ cantidad inválida" });
    }

    // 🔹 Preparar valores
    const valores = [
      m.id_inventario,
      m.producto_id || null,
      m.fecha_ingreso || null,
      m.color_diseño || null,
      m.proveedor || null,
      m.lote || null,
      m.numero_analisis || null,
      cantidad,
      m.factura_o_ordendecompra || null,
      m.tipo || null,
      m.estado || null,
      m.utlimo_movimiento || null,
      m.comentario_cc || null,
      m.dictamen_cc || null
    ];

    // ======================================================
    // 💾 Inserción o actualización automática (idempotente)
    // ======================================================
    await pool.query(
      `INSERT INTO inventario (
        id_inventario, producto_id, fecha_ingreso, color_diseño, proveedor, lote,
        numero_analisis, cantidad, factura_o_ordendecompra, tipo, estado,
        utlimo_movimiento, comentario_cc, dictamen_cc
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        COALESCE($12, NOW()), $13, $14
      )
      ON CONFLICT (id_inventario)
      DO UPDATE SET
        producto_id = EXCLUDED.producto_id,
        fecha_ingreso = EXCLUDED.fecha_ingreso,
        color_diseño = EXCLUDED.color_diseño,
        proveedor = EXCLUDED.proveedor,
        lote = EXCLUDED.lote,
        numero_analisis = EXCLUDED.numero_analisis,
        cantidad = EXCLUDED.cantidad,
        factura_o_ordendecompra = EXCLUDED.factura_o_ordendecompra,
        tipo = EXCLUDED.tipo,
        estado = EXCLUDED.estado,
        utlimo_movimiento = EXCLUDED.utlimo_movimiento,
        comentario_cc = EXCLUDED.comentario_cc,
        dictamen_cc = EXCLUDED.dictamen_cc;`,
      valores
    );

    res.json({
      ok: true,
      mensaje: `✅ Inventario ${m.id_inventario} sincronizado correctamente en Neon.`,
    });
  } catch (err) {
    console.error("❌ Error en inserción de inventario:", err);
    res.status(500).json({
      ok: false,
      mensaje: "Error al insertar o actualizar inventario",
      error: err.message || "Sin mensaje de error",
    });
  }
});

export default router;