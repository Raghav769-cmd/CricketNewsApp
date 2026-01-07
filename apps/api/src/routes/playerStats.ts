import { Router } from "express";
import pool from "../db/connection.js";

const router: Router = Router();

/**
 * GET /api/players/:playerId/stats
 * Fetch stats for a player across all formats
 */
router.get("/:playerId/stats", async (req, res) => {
  try {
    const { playerId } = req.params;

    const result = await pool.query(
      `SELECT 
        id,
        player_id,
        team_id,
        format,
        matches_played,
        runs_scored,
        balls_faced,
        fours,
        sixes,
        centuries,
        half_centuries,
        highest_score,
        times_out,
        wickets_taken,
        runs_conceded,
        overs_bowled,
        best_bowling,
        maidens,
        created_at,
        updated_at
       FROM player_stats 
       WHERE player_id = $1 
       ORDER BY format`,
      [playerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching player stats:", error);
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

/**
 * GET /api/players/:playerId/stats/:format
 * Fetch stats for a specific player and format
 */
router.get("/:playerId/stats/:format", async (req, res) => {
  try {
    const { playerId, format } = req.params;

    // Validate format
    const validFormats = ["1over", "t20", "odi", "test"];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: "Invalid format. Must be: 1over, t20, odi, or test" });
    }

    const result = await pool.query(
      `SELECT 
        id,
        player_id,
        team_id,
        format,
        matches_played,
        runs_scored,
        balls_faced,
        fours,
        sixes,
        centuries,
        half_centuries,
        highest_score,
        times_out,
        wickets_taken,
        runs_conceded,
        overs_bowled,
        best_bowling,
        maidens,
        created_at,
        updated_at
       FROM player_stats 
       WHERE player_id = $1 AND format = $2`,
      [playerId, format]
    );

    if (result.rows.length === 0) {
      return res.json({
        player_id: playerId,
        format: format,
        matches_played: 0,
        runs_scored: 0,
        balls_faced: 0,
        fours: 0,
        sixes: 0,
        centuries: 0,
        half_centuries: 0,
        highest_score: 0,
        times_out: 0,
        wickets_taken: 0,
        runs_conceded: 0,
        overs_bowled: 0,
        best_bowling: "0/0",
        maidens: 0,
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching player stats for format:", error);
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

/**
 * GET /api/teams/:teamId/players
 * Fetch all players in a team with basic info
 */
router.get("/:teamId/players", async (req, res) => {
  try {
    const { teamId } = req.params;

    const result = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.team_id,
        t.name as team_name
       FROM players p
       JOIN teams t ON p.team_id = t.id
       WHERE p.team_id = $1
       ORDER BY p.name`,
      [teamId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching team players:", error);
    res.status(500).json({ error: "Failed to fetch team players" });
  }
});

/**
 * GET /api/teams/:teamId/players-with-stats/:format
 * Fetch all players in a team with their stats for specific format
 */
router.get("/:teamId/players-with-stats/:format", async (req, res) => {
  try {
    const { teamId, format } = req.params;

    // Validate format
    const validFormats = ["1over", "t20", "odi", "test"];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: "Invalid format. Must be: 1over, t20, odi, or test" });
    }

    const result = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.team_id,
        t.name as team_name,
        COALESCE(ps.matches_played, 0) as matches_played,
        COALESCE(ps.runs_scored, 0) as runs_scored,
        COALESCE(ps.balls_faced, 0) as balls_faced,
        COALESCE(ps.fours, 0) as fours,
        COALESCE(ps.sixes, 0) as sixes,
        COALESCE(ps.centuries, 0) as centuries,
        COALESCE(ps.half_centuries, 0) as half_centuries,
        COALESCE(ps.highest_score, 0) as highest_score,
        COALESCE(ps.times_out, 0) as times_out,
        COALESCE(ps.wickets_taken, 0) as wickets_taken,
        COALESCE(ps.runs_conceded, 0) as runs_conceded,
        COALESCE(ps.overs_bowled, 0) as overs_bowled,
        COALESCE(ps.best_bowling, '0/0') as best_bowling,
        COALESCE(ps.maidens, 0) as maidens,
        CASE 
          WHEN COALESCE(ps.times_out, 0) = 0 THEN NULL
          ELSE ROUND(COALESCE(ps.runs_scored, 0)::numeric / COALESCE(ps.times_out, 1)::numeric, 2)
        END as batting_average,
        CASE 
          WHEN COALESCE(ps.balls_faced, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(ps.runs_scored, 0)::numeric / COALESCE(ps.balls_faced, 1)::numeric) * 100, 2)
        END as strike_rate
       FROM players p
       JOIN teams t ON p.team_id = t.id
       LEFT JOIN player_stats ps ON p.id = ps.player_id AND ps.format = $2
       WHERE p.team_id = $1
       ORDER BY p.name`,
      [teamId, format]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching team players with stats:", error);
    res.status(500).json({ error: "Failed to fetch team players with stats" });
  }
});

export default router;
