import { Router } from "express";
import pool from "../db/connection.js";

const router: Router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, city, country, capacity FROM stadiums ORDER BY name ASC"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching stadiums:", error);
    res.status(500).json({ error: "Failed to fetch stadiums" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT id, name, city, country, capacity FROM stadiums WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Stadium not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching stadium:", error);
    res.status(500).json({ error: "Failed to fetch stadium" });
  }
});

export default router;
