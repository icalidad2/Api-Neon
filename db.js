import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.NEON_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on("connect", async (client) => {
  await client.query("SET datestyle = 'ISO, DMY';");
  console.log("📡 Conectado a Neon (formato DD/MM/YYYY).");
});

pool.on("error", (err) => {
  console.error("❌ Error en conexión a Neon:", err.message);
});
