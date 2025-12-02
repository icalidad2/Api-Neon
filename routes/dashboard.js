import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/dashboard/status", async (req, res) => {
  const start = Date.now();

  try {
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - start;

    res.json({
      api: "online",
      db: "online",
      db_latency_ms: dbLatency,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    res.json({
      api: "online",
      db: "offline",
      error: err.message
    });
  }
});

export default router;
