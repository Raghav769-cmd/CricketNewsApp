import { Router } from "express";
import { prisma } from "../db/connection.js";

const router: Router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await prisma.stadiums.findMany({
      orderBy: { name: "asc" },
    });
    res.json(result);
  } catch (error) {
    console.error("Error fetching stadiums:", error);
    res.status(500).json({ error: "Failed to fetch stadiums" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const stadiumId = parseInt(id);

    if (isNaN(stadiumId)) {
      return res.status(400).json({ error: "Invalid stadium ID" });
    }

    const result = await prisma.stadiums.findUnique({
      where: { id: stadiumId },
    });

    if (!result) {
      return res.status(404).json({ error: "Stadium not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching stadium:", error);
    res.status(500).json({ error: "Failed to fetch stadium" });
  }
});

export default router;
