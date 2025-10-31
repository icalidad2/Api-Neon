// index.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";
import movimientosRouter from "./routes/movimientos.js";
import { pool } from "./db.js"; // usamos el pool para shutdown

const app = express();

// ---------- CONFIGURACIONES BASICAS ----------
app.set("trust proxy", true); // si lo pones en prod detrás de proxy/load balancer

// Seguridad HTTP headers
app.use(helmet());

// Logging de peticiones (modo dev)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// CORS - ajusta el origen según tu caso
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*", // en prod mete tu dominio aquí
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
};
app.use(cors(corsOptions));

// Compresión de respuesta
app.use(compression());

// Limitar tamaño de petición y parseo JSON
app.use(express.json({ limit: "200kb" })); // ajusta según necesidades
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// Rate limiter básico
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_MAX || "120", 10), // número de requests por window
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ---------- RUTAS ----------
// Health checks
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.get("/ready", async (req, res) => {
  try {
    // rápido ping a la BD
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

// Montar routers
app.use("/", movimientosRouter);

// ---------- MIDDLEWARE DE ERRORES ----------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    mensaje: err.message || "Error interno del servidor",
    // en dev puedes incluir stack
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
  });
});

// ---------- START Y GRACEFUL SHUTDOWN ----------
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ API lista en ${HOST}:${PORT}`);
});


// cerrar pool y servidor limpio
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

    // forzar salida si tarda mucho
    setTimeout(() => {
      console.warn("🚨 Shutdown forzado.");
      process.exit(1);
    }, 10_000).unref();

  } catch (err) {
    console.error("❌ Error en shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
