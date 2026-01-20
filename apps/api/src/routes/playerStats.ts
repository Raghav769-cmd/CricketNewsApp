import { Router } from "express";
import { prisma } from "../db/connection.js";

const router: Router = Router();

router.get("/:playerId/stats", async (req, res) => {
  try {
    const { playerId } = req.params;
    const pId = parseInt(playerId);

    if (isNaN(pId)) {
      return res.status(400).json({ error: "Invalid player ID" });
    }

    const rows = await prisma.player_stats.findMany({
      where: { player_id: pId },
      orderBy: { format: "asc" },
    });

    const result = rows.map((r: any) => ({
      id: r.id,
      player_id: r.player_id,
      team_id: r.team_id,
      format: r.format,
      matches_played: r.matches_played,
      runs_scored: r.runs_scored,
      balls_faced: r.balls_faced,
      fours: r.fours,
      sixes: r.sixes,
      centuries: r.centuries,
      half_centuries: r.half_centuries,
      highest_score: r.highest_score,
      times_out: r.times_out,
      wickets_taken: r.wickets_taken,
      runs_conceded: r.runs_conceded,
      overs_bowled: r.overs_bowled !== null && typeof r.overs_bowled === "object" ? r.overs_bowled.toString() : (r.overs_bowled ?? 0),
      best_bowling: r.best_bowling,
      maidens: r.maidens,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching player stats:", error);
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

router.get("/:playerId/stats/:format", async (req, res) => {
  try {
    const { playerId, format } = req.params;
    const pId = parseInt(playerId);

    if (isNaN(pId)) {
      return res.status(400).json({ error: "Invalid player ID" });
    }

    // Validate format
    const validFormats = ["1over", "t20", "odi", "test"];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: "Invalid format. Must be: 1over, t20, odi, or test" });
    }

    const row = await prisma.player_stats.findFirst({
      where: { player_id: pId, format },
    });

    if (!row) {
      return res.json({
        player_id: pId,
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

    res.json({
      id: row.id,
      player_id: row.player_id,
      team_id: row.team_id,
      format: row.format,
      matches_played: row.matches_played,
      runs_scored: row.runs_scored,
      balls_faced: row.balls_faced,
      fours: row.fours,
      sixes: row.sixes,
      centuries: row.centuries,
      half_centuries: row.half_centuries,
      highest_score: row.highest_score,
      times_out: row.times_out,
      wickets_taken: row.wickets_taken,
      runs_conceded: row.runs_conceded,
      overs_bowled: row.overs_bowled !== null && typeof row.overs_bowled === "object" ? row.overs_bowled.toString() : (row.overs_bowled ?? 0),
      best_bowling: row.best_bowling,
      maidens: row.maidens,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (error) {
    console.error("Error fetching player stats for format:", error);
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

router.get("/:teamId/players", async (req, res) => {
  try {
    const { teamId } = req.params;
    const tId = parseInt(teamId);

    if (isNaN(tId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const players = await prisma.players.findMany({
      where: { team_id: tId },
      orderBy: { name: "asc" },
    });

    // fetch team name once
    const teamRow = await prisma.teams.findFirst({ where: { id: tId } });
    const teamName = teamRow?.name ?? null;

    const result = players.map((p: any) => ({
      id: p.id,
      name: p.name,
      team_id: p.team_id,
      team_name: teamName,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching team players:", error);
    res.status(500).json({ error: "Failed to fetch team players" });
  }
});

router.get("/:teamId/players-with-stats/:format", async (req, res) => {
  try {
    const { teamId, format } = req.params;
    const tId = parseInt(teamId);

    if (isNaN(tId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Validate format
    const validFormats = ["1over", "t20", "odi", "test"];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: "Invalid format. Must be: 1over, t20, odi, or test" });
    }

    const players = await prisma.players.findMany({
      where: { team_id: tId },
      orderBy: { name: "asc" },
    });

    const playerIds = players.map((p: any) => p.id);
    const stats = await prisma.player_stats.findMany({
      where: { player_id: { in: playerIds }, format },
    });
    const statsMap: Record<number, any> = Object.fromEntries(stats.map((s: any) => [s.player_id, s]));

    // fetch team name once
    const teamRow2 = await prisma.teams.findFirst({ where: { id: tId } });
    const teamName2 = teamRow2?.name ?? null;

    const result = players.map((p: any) => {
      const ps = statsMap[p.id];
      const matches_played = ps?.matches_played ?? 0;
      const runs_scored = ps?.runs_scored ?? 0;
      const balls_faced = ps?.balls_faced ?? 0;
      const times_out = ps?.times_out ?? 0;

      const batting_average = times_out === 0 ? null : Math.round((runs_scored / times_out) * 100) / 100;
      const strike_rate = balls_faced === 0 ? 0 : Math.round((runs_scored / balls_faced) * 100 * 100) / 100;

      return {
        id: p.id,
        name: p.name,
        team_id: p.team_id,
        team_name: teamName2,
        matches_played,
        runs_scored,
        balls_faced,
        fours: ps?.fours ?? 0,
        sixes: ps?.sixes ?? 0,
        centuries: ps?.centuries ?? 0,
        half_centuries: ps?.half_centuries ?? 0,
        highest_score: ps?.highest_score ?? 0,
        times_out,
        wickets_taken: ps?.wickets_taken ?? 0,
        runs_conceded: ps?.runs_conceded ?? 0,
        overs_bowled: ps ? (ps.overs_bowled !== null && typeof ps.overs_bowled === "object" ? ps.overs_bowled.toString() : ps.overs_bowled) : 0,
        best_bowling: ps?.best_bowling ?? "0/0",
        maidens: ps?.maidens ?? 0,
        batting_average,
        strike_rate,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching team players with stats:", error);
    res.status(500).json({ error: "Failed to fetch team players with stats" });
  }
});

export default router;
