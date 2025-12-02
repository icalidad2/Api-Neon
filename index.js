// index.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";

import movimientosRouter from "./routes/almacen/movimientos.js";
import inventarioRouter from "./routes/almacen/inventario.js";
import produccionpiRouter from "./routes/inyeccion/produccionpi.js";
import produccionpsRouter from "./routes/procesos/produccionps.js";
import psordenesproduccionRouter from "./routes/procesos/psordenesproduccion.js";
import piordenesproduccionRouter from "./routes/inyeccion/piordenesproduccion.js";

import { pool } from "#db";
import dashboardRouter from "./routes/dashboard.js";

// ---------- APP (debe ir ANTES de usar app.use) ----------
const app = express();

// ---------- CONFIGURACIONES BASICAS ----------
app.set("trust proxy", 1);

// Seguridad HTTP headers
app.use(helmet());

// Logging de peticiones
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
};
app.use(cors(corsOptions));

// Compresión
app.use(compression());

// Body parser
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ---------- RUTAS ----------

// Dashboard primero
app.use("/", dashboardRouter);

// Health checks
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ready: true });
  } catch (err) {
    res.status(503).json({ ready: false, error: err.message });
  }
});

// Ruta base
app.get("/", (req, res) => {
  res.json({ estado: "OK", hora: new Date().toISOString() });
});

// Routers de Almacén
app.use("/", movimientosRouter);
app.use("/", inventarioRouter);

// Routers de Inyección
app.use("/", produccionpiRouter);
app.use("/", piordenesproduccionRouter);

// Routers de Procesos Secundarios
app.use("/", produccionpsRouter);
app.use("/", psordenesproduccionRouter);

// ---------- MIDDLEWARE DE ERRORES ----------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    mensaje: err.message || "Error interno del servidor",
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
  });
});

// ---------- START Y GRACEFUL SHUTDOWN ----------
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ API lista en ${HOST}:${PORT}`);
});

// Shutdown limpio
const shutdown = async (signal) => {
  try {
    console.log(`🔌 Recibido ${signal} — cerrando servidor...`);
    server.close(async () => {
      try {
        await pool.end();
        console.log("🟢 Pool DB cerrado. Proceso finalizado.");
        process.exit(0);
      } catch (err) {
        console.error("❌ Error cerrando pool:", err);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.warn("🚨 Shutdown forzado.");
      process.exit(1);
    }, 10000).unref();

  } catch (err) {
    console.error("❌ Error en shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
