import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const app = express();
app.use(express.json());

// 🔹 Conexión a Neon
const pool = new Pool({
  connectionString: process.env.NEON_URL,
  ssl: { rejectUnauthorized: false }
});

// ✅ Configurar formato latino de fecha (DD/MM/YYYY)
pool.on("connect", async (client) => {
  await client.query("SET datestyle = 'ISO, DMY';");
});

// 🔹 Endpoint raíz para verificar estado
app.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT NOW() as hora");
    res.json({ estado: "OK", hora: rows[0].hora });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// =============================================================
// 🧩 NUEVO ENDPOINT: Sincronización con soporte INSERT + UPDATE
// =============================================================
app.post("/sync_movimiento", async (req, res) => {
  try {
    const m = req.body;

    // --- 1️⃣ Validaciones básicas ---
    if (!m.ID_Movimiento) {
      return res.json({ ok: false, mensaje: "❌ Falta ID_Movimiento." });
    }

    const cantidad = parseFloat(m.Cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      return res.json({ ok: false, mensaje: "⚠️ Cantidad inválida." });
    }

    const movimientosPermitidos = [
      "Entrada de Materia Prima",
      "Entrada Interna de Producción",
      "Surtido de Ordenes",
      "Devolución Interna",
      "Ajuste de Inventario",
      "Envio de Producto Terminado"
    ];

    if (!movimientosPermitidos.includes(m["Tipo de Movimiento"])) {
      return res.json({
        ok: false,
        mensaje: `⚠️ Tipo de movimiento no permitido: "${m["Tipo de Movimiento"]}".`,
      });
    }

    // --- 2️⃣ Buscar si ya existe el movimiento ---
    const existe = await pool.query(
      "SELECT * FROM movimientos WHERE id_movimiento = $1 LIMIT 1",
      [m.ID_Movimiento]
    );

    // --- 3️⃣ Si no existe → INSERT ---
    if (existe.rowCount === 0) {
      await pool.query(
        `INSERT INTO movimientos (
          id_movimiento, fecha_hora, tipo_movimiento, origen, producto,
          color_disenio, cantidad, proveedor, lote_proveedor, numero_analisis,
          orden_produccion, orden_compra, cliente, quien_entrega, quien_recibe,
          observaciones, inventario_id, id_solicitud, id_detalle, reff_movimiento, producto_form
        )
        VALUES (
          $1, TO_TIMESTAMP($2, 'DD/MM/YYYY HH24:MI:SS'), $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21
        )`,
        [
          m.ID_Movimiento, m["Fecha y Hora"], m["Tipo de Movimiento"], m.Origen, m.Producto,
          m["Color/Diseño"], cantidad, m.Proveedor, m["Lote del Proveedor"], m["Número de Analisis"],
          m["Orden de Producción"], m["Orden de Compra"], m.Cliente, m["Quien Entrega"], m["Quien Recibe"],
          m.Observaciones, m.Inventario_ID, m.ID_Solicitud, m.id_detalle, m.reff_movimiento, m.producto_form
        ]
      );
      return res.json({ ok: true, mensaje: `✅ Movimiento ${m.ID_Movimiento} insertado.` });
    }

    // --- 4️⃣ Si existe → verificar diferencias ---
    const registroDB = existe.rows[0];
    let cambios = [];

    // Campos comparables
    const campos = [
      "tipo_movimiento","origen","producto","color_disenio","cantidad","proveedor",
      "lote_proveedor","numero_analisis","orden_produccion","orden_compra","cliente",
      "quien_entrega","quien_recibe","observaciones","inventario_id","id_solicitud",
      "id_detalle","reff_movimiento","producto_form"
    ];

    campos.forEach(campo => {
      const valDB = registroDB[campo] ?? "";
      const valNuevo = (m[campo] ?? "").toString();
      if (valDB.toString() !== valNuevo) cambios.push(campo);
    });

    if (cambios.length === 0) {
      return res.json({
        ok: true,
        mensaje: `⏭️ Movimiento ${m.ID_Movimiento} ya actualizado (sin cambios).`
      });
    }

    // --- 5️⃣ UPDATE solo de campos modificados ---
    const setQuery = cambios.map((campo, idx) => `${campo} = $${idx + 2}`).join(", ");
    const valores = cambios.map(c => m[c]);
    await pool.query(
      `UPDATE movimientos
       SET ${setQuery}, fecha_actualizacion = NOW()
       WHERE id_movimiento = $1`,
      [m.ID_Movimiento, ...valores]
    );

    res.json({
      ok: true,
      mensaje: `🔁 Movimiento ${m.ID_Movimiento} actualizado (${cambios.length} campos).`,
      campos_actualizados: cambios
    });

  } catch (e) {
    console.error("❌ Error en sincronización:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});


// =============================================================
// 🔹 Endpoint legado para compatibilidad (solo inserta nuevos)
// =============================================================
app.post("/insertar_movimiento", async (req, res) => {
  try {
    const m = req.body;
    const existe = await pool.query(
      "SELECT 1 FROM movimientos WHERE id_movimiento = $1 LIMIT 1",
      [m.ID_Movimiento]
    );

    if (existe.rowCount > 0) {
      return res.json({
        ok: false,
        mensaje: `⚠️ El movimiento ${m.ID_Movimiento} ya existe. Registro duplicado omitido.`,
      });
    }

    await pool.query(
      `INSERT INTO movimientos (
        id_movimiento, fecha_hora, tipo_movimiento, origen, producto,
        color_disenio, cantidad, proveedor, lote_proveedor, numero_analisis,
        orden_produccion, orden_compra, cliente, quien_entrega, quien_recibe,
        observaciones, inventario_id, id_solicitud, id_detalle, reff_movimiento, producto_form
      )
      VALUES (
        $1, TO_TIMESTAMP($2, 'DD/MM/YYYY HH24:MI:SS'), $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21
      )`,
      [
        m.ID_Movimiento, m["Fecha y Hora"], m["Tipo de Movimiento"], m.Origen, m.Producto,
        m["Color/Diseño"], m.Cantidad, m.Proveedor, m["Lote del Proveedor"], m["Número de Analisis"],
        m["Orden de Producción"], m["Orden de Compra"], m.Cliente, m["Quien Entrega"], m["Quien Recibe"],
        m.Observaciones, m.Inventario_ID, m.ID_Solicitud, m.id_detalle, m.reff_movimiento, m.producto_form
      ]
    );

    res.json({ ok: true, mensaje: `Movimiento ${m.ID_Movimiento} insertado correctamente ✅` });

  } catch (e) {
    console.error("❌ Error al insertar movimiento:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🔹 Arrancar el servidor
app.listen(3000, () => console.log("✅ API lista en puerto 3000"));
