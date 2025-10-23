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

// 🔹 Endpoint para insertar un movimiento desde Google Sheets
app.post("/insertar_movimiento", async (req, res) => {
  try {
    const m = req.body;

    // 🔍 Validación 1: ID único (no duplicado)
    const existe = await pool.query(
      "SELECT 1 FROM movimientos_test WHERE id_movimiento = $1 LIMIT 1",
      [m.ID_Movimiento]
    );

    if (existe.rowCount > 0) {
      return res.json({
        ok: false,
        mensaje: `⚠️ El movimiento ${m.ID_Movimiento} ya existe. Registro duplicado omitido.`,
      });
    }

    // 🔍 Validación 2: Tipo de movimiento permitido
    const movimientosPermitidos = [
      "Entrada de Materia Prima",
      "Entrada Interna de Producción",
      "Surtido de Ordenes",
      "Devolución Interna",
      "Ajuste de Inventario"
    ];

    if (!movimientosPermitidos.includes(m["Tipo de Movimiento"])) {
      return res.json({
        ok: false,
        mensaje: `⚠️ Tipo de movimiento no permitido: "${m["Tipo de Movimiento"]}".`,
      });
    }

    // 🔍 Validación 3: Cantidad numérica y positiva
    const cantidad = parseFloat(m.Cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      return res.json({
        ok: false,
        mensaje: `⚠️ Cantidad inválida: "${m.Cantidad}". Debe ser un número positivo.`,
      });
    }

    // 🧾 Inserción si todas las validaciones pasan
    await pool.query(
      `INSERT INTO movimientos_test (
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

    res.json({ ok: true, mensaje: `Movimiento ${m.ID_Movimiento} insertado correctamente ✅` });

  } catch (e) {
    console.error("❌ Error al insertar movimiento:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🔹 Arrancar el servidor
app.listen(3000, () => console.log("✅ API lista en puerto 3000"));
