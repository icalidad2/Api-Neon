import express from "express";
import { pool } from "../../db.js";

const router = express.Router();

// ======================================================
// 🧭 Normalizador de campos (Google Sheets → SQL fields)
// ======================================================
function normalizarClaves(obj) {
  const map = {
    "id_movimiento": "id_movimiento",
    "fecha_y_hora": "fecha_hora",
    "fecha_hora": "fecha_hora",
    "tipo_de_movimiento": "tipo_movimiento",
    "tipo_movimiento": "tipo_movimiento",
    "origen": "origen",
    "producto": "producto",
    "color/diseño": "color_disenio",
    "color_diseño": "color_disenio",
    "cantidad": "cantidad",
    "proveedor": "proveedor",
    "lote_del_proveedor": "lote_proveedor",
    "lote_proveedor": "lote_proveedor",
    "número_de_analisis": "numero_analisis",
    "numero_de_analisis": "numero_analisis",
    "orden_de_producción": "orden_produccion",
    "orden_de_produccion": "orden_produccion",
    "orden_de_compra": "orden_compra",
    "cliente": "cliente",
    "quien_entrega": "quien_entrega",
    "quien_recibe": "quien_recibe",
    "observaciones": "observaciones",
    "inventario_id": "inventario_id",
    "id_solicitud": "id_solicitud",
    "id_detalle": "id_detalle",
    "reff_movimiento": "reff_movimiento",
    "producto_form": "producto_form"
  };

  const nuevo = {};
  for (let key in obj) {
    const limpio = key.trim().toLowerCase().replace(/\s+/g, "_");
    nuevo[map[limpio] || limpio] = obj[key];
  }
  return nuevo;
}

// ======================================================
// 🚀 Endpoint principal: sincronización de movimientos
// ======================================================
router.post("/sync_movimiento", async (req, res) => {
  try {
    const m = normalizarClaves(req.body);
    console.log("📦 Datos recibidos y normalizados:", m);

    // 🔹 Validaciones mínimas obligatorias
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

    // 🔹 Valores en orden exacto de columnas SQL
    const valores = [
      m.id_movimiento,
      m.fecha_hora || null,
      m.tipo_movimiento,
      m.origen || null,
      m.producto || null,
      m.color_disenio || null,
      cantidad,
      m.proveedor || null,
      m.lote_proveedor || null,
      m.numero_analisis || null,
      m.orden_produccion || null,
      m.orden_compra || null,
      m.cliente || null,
      m.quien_entrega || null,
      m.quien_recibe || null,
      m.observaciones || null,
      m.inventario_id || null,
      m.id_solicitud || null,
      m.id_detalle || null,
      m.reff_movimiento || null,
      m.producto_form || null
    ];

    // ======================================================
    // 💾 Inserción o actualización automática (idempotente)
    // ======================================================
    await pool.query(
      `INSERT INTO movimientos (
        id_movimiento, fecha_hora, tipo_movimiento, origen, producto, color_disenio, cantidad,
        proveedor, lote_proveedor, numero_analisis, orden_produccion, orden_compra,
        cliente, quien_entrega, quien_recibe, observaciones,
        inventario_id, id_solicitud, id_detalle, reff_movimiento, producto_form, fecha_actualizacion
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21, NOW()
      )
      ON CONFLICT (id_movimiento)
      DO UPDATE SET
        fecha_hora = EXCLUDED.fecha_hora,
        tipo_movimiento = EXCLUDED.tipo_movimiento,
        origen = EXCLUDED.origen,
        producto = EXCLUDED.producto,
        color_disenio = EXCLUDED.color_disenio,
        cantidad = EXCLUDED.cantidad,
        proveedor = EXCLUDED.proveedor,
        lote_proveedor = EXCLUDED.lote_proveedor,
        numero_analisis = EXCLUDED.numero_analisis,
        orden_produccion = EXCLUDED.orden_produccion,
        orden_compra = EXCLUDED.orden_compra,
        cliente = EXCLUDED.cliente,
        quien_entrega = EXCLUDED.quien_entrega,
        quien_recibe = EXCLUDED.quien_recibe,
        observaciones = EXCLUDED.observaciones,
        inventario_id = EXCLUDED.inventario_id,
        id_solicitud = EXCLUDED.id_solicitud,
        id_detalle = EXCLUDED.id_detalle,
        reff_movimiento = EXCLUDED.reff_movimiento,
        producto_form = EXCLUDED.producto_form,
        fecha_actualizacion = NOW();`,
      valores
    );

    // ✅ Respuesta JSON
    res.json({
      ok: true,
      mensaje: `✅ Movimiento ${m.id_movimiento} sincronizado correctamente en Neon.`,
    });
  } catch (err) {
    console.error("❌ Error completo en inserción:", err);
    res.status(500).json({
      ok: false,
      mensaje: "Error al insertar o actualizar en Neon",
      error: err.message || "Sin mensaje de error",
    });
  }
});

export default router;