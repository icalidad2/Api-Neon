import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.NEON_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT NOW() as hora");
    res.json({ estado: "OK", hora: rows[0].hora });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("✅ API lista en puerto 3000"));
