import { Router } from "express";
import pool from "../db/connection.js";
import { getIO } from "../server.ts";
import { verifyToken, isSuperadmin, isAdmin, isAuthenticated } from "../middleware/auth.ts";

const router: Router = Router();

// get all matches
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        t1.id   AS team1_id,
        t1.name AS team1_name,
        t2.id   AS team2_id,
        t2.name AS team2_name
      FROM matches m
      JOIN teams t1 ON t1.id = m.team1
      JOIN teams t2 ON t2.id = m.team2
    `);
    res.json(result.rows);
    // console.log(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// get match by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        m.*,
        t1.id   AS team1_id,
        t1.name AS team1_name,
        t2.id   AS team2_id,
        t2.name AS team2_name
      FROM matches m
      JOIN teams t1 ON t1.id = m.team1
      JOIN teams t2 ON t2.id = m.team2
      WHERE m.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).send("Match not found");
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Add match - Superadmin only
router.post("/", verifyToken, isSuperadmin, async (req, res) => {
  const { team1, team2, date, venue, score, overs_per_inning } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO matches (team1, team2, date, venue, score, overs_per_inning, current_inning, inning1_complete) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [team1, team2, date, venue, score, overs_per_inning, 1, false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Update a match
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { team1, team2, date, venue, score, overs_per_inning } = req.body;
  try {
    const result = await pool.query(
      "UPDATE matches SET team1 = $1, team2 = $2, date = $3, venue = $4, score = $5, overs_per_inning = $6 WHERE id = $7 RETURNING *",
      [team1, team2, date, venue, score, overs_per_inning, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send("Match not found");
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Update inning status - Admin only
router.put("/:id/inning", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { battingTeamId } = req.body;
  try {
    const result = await pool.query(
      `UPDATE matches 
       SET inning1_team_id = $1, inning1_complete = true, current_inning = 2 
       WHERE id = $2 
       RETURNING *`,
      [battingTeamId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send("Match not found");
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Delete a match - Superadmin only
router.delete("/:id", verifyToken, isSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM matches WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send("Match not found");
    }
    res.json({ message: "Match deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Get aggregated score for a match (both teams)
router.get("/:id/score", async (req, res) => {
  const { id } = req.params;
  try {
    // Get match details
    const matchResult = await pool.query(
      "SELECT * FROM matches WHERE id = $1",
      [id]
    );
    if (matchResult.rows.length === 0) {
      return res.status(404).send("Match not found");
    }
    const match = matchResult.rows[0];

    // Aggregate scores per team
    const scoreQuery = `
      SELECT 
        o.batting_team_id,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
        COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets,
        COALESCE(MAX(o.over_number), 1) - 1 as completed_overs,
        MAX(CASE WHEN o.over_number = (SELECT MAX(over_number) FROM overs WHERE match_id = $1 AND batting_team_id = o.batting_team_id) 
            THEN (SELECT SUM(CASE WHEN NOT ((COALESCE(extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(event,'') ~* '^(wide|wd|no-?ball|nb)')) THEN 1 ELSE 0 END) FROM balls WHERE over_id = o.id) 
            ELSE 0 END) as balls_in_current_over
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1 AND o.batting_team_id IS NOT NULL
      GROUP BY o.batting_team_id
    `;

    const scoreResult = await pool.query(scoreQuery, [id]);

    const scores = scoreResult.rows.map((row) => {
      let completedOvers = parseInt(row.completed_overs) || 0;
      let ballsInOver = parseInt(row.balls_in_current_over) || 0;

      // Handle rollover: if balls >= 6, add to completed overs
      if (ballsInOver >= 6) {
        completedOvers += Math.floor(ballsInOver / 6);
        ballsInOver = ballsInOver % 6;
      }

      return {
        teamId: row.batting_team_id,
        runs: parseInt(row.total_runs) || 0,
        wickets: parseInt(row.wickets) || 0,
        overs: `${completedOvers}.${ballsInOver}`,
      };
    });

    res.json({
      matchId: parseInt(id),
      team1: match.team1,
      team2: match.team2,
      scores,
    });
  } catch (err) {
    console.error("Error fetching match score:", err);
    res.status(500).send("Server Error");
  }
});

// Get aggregated score for a specific team in a match
router.get("/:id/teams/:teamId/score", async (req, res) => {
  const { id, teamId } = req.params;
  try {
    const scoreQuery = `
      SELECT 
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
        COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets,
        COALESCE(MAX(o.over_number), 1) - 1 as completed_overs,
        MAX(CASE WHEN o.over_number = (SELECT MAX(over_number) FROM overs WHERE match_id = $1 AND batting_team_id = $2) 
            THEN (SELECT SUM(CASE WHEN NOT ((COALESCE(extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(event,'') ~* '^(wide|wd|no-?ball|nb)')) THEN 1 ELSE 0 END) FROM balls WHERE over_id = o.id) 
            ELSE 0 END) as balls_in_current_over
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1 AND o.batting_team_id = $2
    `;

    const scoreResult = await pool.query(scoreQuery, [id, teamId]);

    if (scoreResult.rows.length === 0 || !scoreResult.rows[0].total_runs) {
      return res.json({
        matchId: parseInt(id),
        teamId: parseInt(teamId),
        runs: 0,
        wickets: 0,
        overs: "0.0",
      });
    }

    const row = scoreResult.rows[0];
    let completedOvers = parseInt(row.completed_overs) || 0;
    let ballsInOver = parseInt(row.balls_in_current_over) || 0;

    // Handle rollover: if balls >= 6, add to completed overs
    if (ballsInOver >= 6) {
      completedOvers += Math.floor(ballsInOver / 6);
      ballsInOver = ballsInOver % 6;
    }

    res.json({
      matchId: parseInt(id),
      teamId: parseInt(teamId),
      runs: parseInt(row.total_runs) || 0,
      wickets: parseInt(row.wickets) || 0,
      overs: `${completedOvers}.${ballsInOver}`,
    });
  } catch (err) {
    console.error("Error fetching team score:", err);
    res.status(500).send("Server Error");
  }
});

// Add a new ball to a match - Admin only (live scoring)
router.post("/:matchId/ball", verifyToken, isAdmin, async (req, res) => {
  const { matchId } = req.params;
  const {
    overNumber,
    ballNumber,
    runs,
    extras,
    wicket,
    event,
    batsmanId,
    bowlerId,
    battingTeamId,
  } = req.body;

  try {
    // Find or create the over
    let overResult = await pool.query(
      "SELECT id FROM overs WHERE match_id = $1 AND over_number = $2 AND batting_team_id = $3",
      [matchId, overNumber, battingTeamId]
    );

    let overId;
    if (overResult.rows.length === 0) {
      // Create new over if it doesn't exist
      const newOver = await pool.query(
        "INSERT INTO overs (match_id, over_number, batting_team_id) VALUES ($1, $2, $3) RETURNING id",
        [matchId, overNumber, battingTeamId]
      );
      overId = newOver.rows[0].id;
    } else {
      overId = overResult.rows[0].id;
    }

    // Insert the ball
    const eventValue =
      event && String(event).trim().length > 0
        ? String(event).trim()
        : wicket
          ? "wicket"
          : null;
    const isWicket =
      Boolean(wicket) ||
      (typeof eventValue === "string" && /wicket|\bout\b/i.test(eventValue));

    const ballResult = await pool.query(
      `INSERT INTO balls (over_id, ball_number, runs, extras, event, is_wicket, batsman_id, bowler_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        overId,
        ballNumber,
        runs || 0,
        extras || "0",
        eventValue,
        isWicket,
        batsmanId,
        bowlerId,
      ]
    );

    // Emit live update via socket.io
    const io = getIO();
    if (io) {
      const displayOver = Math.max(0, overNumber - 1);
      const displayBall = Math.max(0, ballNumber - 1);
      const payload = {
        matchId: String(matchId),
        liveScore: `Over ${displayOver}.${displayBall}: ${runs || 0} runs${wicket ? " - WICKET!" : ""}`,
        ball: ballResult.rows[0],
      };
      console.log("Emitting ballUpdate:", payload);
      io.to(`match_${matchId}`).emit("ballUpdate", payload);
    }

    res.status(201).json(ballResult.rows[0]);
  } catch (err) {
    console.error("Error adding ball:", err);
    res.status(500).send("Server Error");
  }
});

// Convenience endpoint to emit a live update for a match (for testing)
router.post("/:id/emit", async (req, res) => {
  const { id } = req.params;
  const { liveScore } = req.body || {
    liveScore: `Manual update for match ${id}`,
  };
  try {
    const io = getIO();
    if (!io) return res.status(500).send("Socket.io not initialized");
    const payload = { matchId: String(id), liveScore };
    console.log("Manual emit ballUpdate:", payload);
    io.to(`match_${id}`).emit("ballUpdate", payload);
    res.status(200).send("Emitted");
  } catch (err) {
    console.error("Error emitting manual update:", err);
    res.status(500).send("Emit failed");
  }
});

// Get ball-by-ball timeline for a match
router.get("/:id/balls", async (req, res) => {
  const { id } = req.params;
  try {
    const q = `
            SELECT b.id as ball_id, o.over_number, b.ball_number, b.runs, b.extras, b.event, b.is_wicket,
             b.batsman_id, pb.name as batsman_name,
             b.bowler_id, pw.name as bowler_name,
             o.batting_team_id
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players pb ON b.batsman_id = pb.id
      LEFT JOIN players pw ON b.bowler_id = pw.id
      WHERE o.match_id = $1
      ORDER BY o.over_number ASC, b.ball_number ASC, b.id ASC
    `;

    const result = await pool.query(q, [id]);
    const rows = result.rows.map((r: any) => ({
      ballId: r.ball_id,
      overNumber: r.over_number,
      ballNumber: r.ball_number,
      runs: parseInt(r.runs) || 0,
      extras: r.extras,
      event: r.event,
      isWicket: Boolean(r.is_wicket),
      batsmanId: r.batsman_id,
      batsmanName: r.batsman_name,
      bowlerId: r.bowler_id,
      bowlerName: r.bowler_name,
      battingTeamId: r.batting_team_id,
    }));

    res.json(rows);
  } catch (err) {
    console.error("Error fetching balls timeline:", err);
    res.status(500).send("Server Error");
  }
});

// Get scorecard for a match (batting + bowling + extras per innings)
router.get("/:id/scorecard", async (req, res) => {
  const { id } = req.params;
  try {
    // Batting aggregates per batting team and batsman
    const battingQuery = `
      SELECT o.batting_team_id AS team_id,
             b.batsman_id,
             p.name AS batsman_name,
             SUM(b.runs) AS runs,
             COUNT(*) FILTER (WHERE NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)'))) AS balls,
             COUNT(*) FILTER (WHERE b.runs = 4) AS fours,
             COUNT(*) FILTER (WHERE b.runs = 6) AS sixes
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players p ON b.batsman_id = p.id
      WHERE o.match_id = $1 AND b.batsman_id IS NOT NULL
      GROUP BY o.batting_team_id, b.batsman_id, p.name
      ORDER BY o.batting_team_id, SUM(b.runs) DESC;
    `;

    // Dismissals: earliest wicket ball per dismissed batsman
    const dismissalsQuery = `
      SELECT o.batting_team_id AS team_id,
             b.batsman_id,
             b.event,
             pw.name AS bowler_name,
             (o.over_number - 1) * 6 + b.ball_number AS idx
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players pw ON b.bowler_id = pw.id
      WHERE o.match_id = $1 AND b.is_wicket = TRUE AND b.batsman_id IS NOT NULL
      ORDER BY idx;
    `;

    // Bowling aggregates (as bowler vs batting team)
    const bowlingQuery = `
      SELECT o.batting_team_id AS batting_team_id,
             b.bowler_id,
             p.name AS bowler_name,
             COUNT(*) FILTER (WHERE NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)'))) AS balls,
             SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER),0)) AS runs_conceded,
             SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) AS wickets
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players p ON b.bowler_id = p.id
      WHERE o.match_id = $1 AND b.bowler_id IS NOT NULL
      GROUP BY o.batting_team_id, b.bowler_id, p.name
      ORDER BY o.batting_team_id, SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) DESC;
    `;

    // Extras and totals per batting team
    const totalsQuery = `
      SELECT o.batting_team_id AS team_id,
             SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER),0)) AS total_runs,
             SUM(COALESCE(CAST(b.extras AS INTEGER),0)) AS extras,
             SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) AS wickets,
             SUM(CASE WHEN NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)')) THEN 1 ELSE 0 END) AS balls
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      WHERE o.match_id = $1
      GROUP BY o.batting_team_id
      ORDER BY o.batting_team_id;
    `;

    // Determine striker (the batsman who faced the most recent ball) per batting team
    const strikerQuery = `
      SELECT DISTINCT ON (o.batting_team_id)
        o.batting_team_id AS team_id,
        b.batsman_id AS striker_id
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      WHERE o.match_id = $1 AND b.batsman_id IS NOT NULL
      ORDER BY o.batting_team_id, b.id DESC
    `;

    const [batRes, disRes, bowlRes, totalsRes, strikerRes] = await Promise.all([
      pool.query(battingQuery, [id]),
      pool.query(dismissalsQuery, [id]),
      pool.query(bowlingQuery, [id]),
      pool.query(totalsQuery, [id]),
      pool.query(strikerQuery, [id]),
    ]);

    const strikerMap: Record<number, number> = {};
    for (const r of strikerRes.rows) {
      strikerMap[r.team_id] = r.striker_id;
    }

    // Map dismissals by team_id + batsman_id to the earliest dismissal
    const dismissalMap: Record<string, any> = {};
    for (const r of disRes.rows) {
      const key = `${r.team_id}_${r.batsman_id}`;
      if (!dismissalMap[key])
        dismissalMap[key] = { event: r.event, bowlerName: r.bowler_name };
    }

    // Group batting rows per team
    const teams: Record<number, any> = {};
    for (const r of batRes.rows) {
      const teamId = r.team_id;
      if (!teams[teamId])
        teams[teamId] = { batting: [], bowling: [], totals: null };
      const key = `${teamId}_${r.batsman_id}`;
      const dismiss = dismissalMap[key];
      const notOut = !dismiss;
      const dismissalText = dismiss
        ? dismiss.event
          ? String(dismiss.event)
          : `b ${dismiss.bowlerName || "Unknown"}`
        : "not out";
      teams[teamId].batting.push({
        playerId: r.batsman_id,
        playerName: r.batsman_name,
        runs: parseInt(r.runs) || 0,
        balls: parseInt(r.balls) || 0,
        fours: parseInt(r.fours) || 0,
        sixes: parseInt(r.sixes) || 0,
        dismissal: dismissalText,
        notOut,
        isStriker: strikerMap[teamId] === r.batsman_id,
      });
    }

    // Attach bowling lists (note: bowling rows are grouped by batting_team_id — bowlers who bowled to that batting team)
    for (const r of bowlRes.rows) {
      const teamId = r.batting_team_id;
      if (!teams[teamId])
        teams[teamId] = { batting: [], bowling: [], totals: null };
      teams[teamId].bowling.push({
        playerId: r.bowler_id,
        playerName: r.bowler_name,
        balls: parseInt(r.balls) || 0,
        runsConceded: parseInt(r.runs_conceded) || 0,
        wickets: parseInt(r.wickets) || 0,
      });
    }

    // Attach totals
    for (const r of totalsRes.rows) {
      const teamId = r.team_id;
      if (!teams[teamId])
        teams[teamId] = { batting: [], bowling: [], totals: null };
      teams[teamId].totals = {
        totalRuns: parseInt(r.total_runs) || 0,
        extras: parseInt(r.extras) || 0,
        wickets: parseInt(r.wickets) || 0,
        balls: parseInt(r.balls) || 0,
      };
    }

    res.json({ matchId: Number(id), teams });
  } catch (err) {
    console.error("Error fetching scorecard:", err);
    res.status(500).send("Server Error");
  }
});

router.get("/:id/insights", async (req, res) => {
  const { id } = req.params;
  try {
    const battingStatsQuery = `
      WITH ball_pos AS (
        SELECT b.batsman_id,
               MIN((o.over_number - 1) * 6 + b.ball_number) AS first_ball_index
        FROM balls b
        JOIN overs o ON b.over_id = o.id
        WHERE o.match_id = $1 AND b.batsman_id IS NOT NULL
        GROUP BY b.batsman_id
      ),
      batting AS (
        SELECT b.batsman_id AS player_id,
               p.name AS player_name,
               SUM(b.runs) AS runs,
               COUNT(*) FILTER (WHERE b.runs = 4) AS fours,
               COUNT(*) FILTER (WHERE b.runs = 6) AS sixes,
               COUNT(*) FILTER (WHERE NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)'))) AS balls_faced,
               bp.first_ball_index
        FROM balls b
        JOIN overs o ON b.over_id = o.id
        LEFT JOIN players p ON b.batsman_id = p.id
        LEFT JOIN ball_pos bp ON bp.batsman_id = b.batsman_id
        WHERE o.match_id = $1 AND b.batsman_id IS NOT NULL
        GROUP BY b.batsman_id, p.name, bp.first_ball_index
      )
      SELECT *, ROW_NUMBER() OVER (ORDER BY first_ball_index) as batting_position
      FROM batting
      ORDER BY runs DESC;
    `;

    // 2) Team totals and match aggregate
    const teamTotalsQuery = `
            SELECT o.batting_team_id AS team_id,
              SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) AS runs,
              COUNT(CASE WHEN b.is_wicket THEN 1 END) AS wickets
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1
      GROUP BY o.batting_team_id;
    `;

    // 3) Total sixes in the match
    const sixesQuery = `
      SELECT COUNT(*) AS sixes FROM balls b JOIN overs o ON b.over_id = o.id WHERE o.match_id = $1 AND b.runs = 6;
    `;

    const [battingRes, teamTotalsRes, sixesRes] = await Promise.all([
      pool.query(battingStatsQuery, [id]),
      pool.query(teamTotalsQuery, [id]),
      pool.query(sixesQuery, [id]),
    ]);

    const battingRows = battingRes.rows.map((r: any) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      runs: parseInt(r.runs) || 0,
      fours: parseInt(r.fours) || 0,
      sixes: parseInt(r.sixes) || 0,
      balls: parseInt(r.balls_faced) || 0,
      battingPosition: parseInt(r.batting_position) || null,
    }));

    const lowOrder30Count = battingRows.filter(
      (p: any) => p.battingPosition >= 4 && p.runs > 30
    ).length;

    const teamTotals = teamTotalsRes.rows.map((r: any) => ({
      teamId: r.team_id,
      runs: parseInt(r.runs) || 0,
      wickets: parseInt(r.wickets) || 0,
    }));

    const totalSixes =
      (sixesRes.rows[0] && parseInt(sixesRes.rows[0].sixes)) || 0;

    // Top performers
    const topScorers = battingRows.slice(0, 5);
    const topSixHitters = battingRows
      .sort((a: any, b: any) => b.sixes - a.sixes)
      .slice(0, 5);

    res.json({
      matchId: parseInt(id),
      topScorers,
      topSixHitters,
      teamTotals,
      totalSixes,
      lowOrder30Count,
    });
  } catch (err) {
    console.error("Error computing insights:", err);
    res.status(500).send("Server Error");
  }
});

// Get player stats for all players in a match (grouped by team)
router.get("/:id/player-stats", async (req, res) => {
  const { id } = req.params;
  try {
    // Batting stats per player per match
    const battingQuery = `
      SELECT 
        o.batting_team_id AS team_id,
        b.batsman_id AS player_id,
        p.name AS player_name,
        SUM(b.runs) AS runs,
        COUNT(*) FILTER (WHERE NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)'))) AS balls,
        COUNT(*) FILTER (WHERE b.runs = 4) AS fours,
        COUNT(*) FILTER (WHERE b.runs = 6) AS sixes,
        COUNT(*) FILTER (WHERE b.is_wicket) AS times_out,
        MAX(CASE WHEN b.is_wicket THEN b.event END) AS dismissal
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players p ON b.batsman_id = p.id
      WHERE o.match_id = $1 AND b.batsman_id IS NOT NULL
      GROUP BY o.batting_team_id, b.batsman_id, p.name
      ORDER BY o.batting_team_id, SUM(b.runs) DESC
    `;

    // Bowling stats per player per match
    const bowlingQuery = `
      SELECT 
        o.batting_team_id AS batting_team_id,
        b.bowler_id AS player_id,
        p.name AS player_name,
        COUNT(*) FILTER (WHERE NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)'))) AS balls,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER),0)) AS runs_conceded,
        SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) AS wickets,
        COUNT(*) FILTER (WHERE b.runs = 4) AS fours_conceded,
        COUNT(*) FILTER (WHERE b.runs = 6) AS sixes_conceded
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players p ON b.bowler_id = p.id
      WHERE o.match_id = $1 AND b.bowler_id IS NOT NULL
      GROUP BY o.batting_team_id, b.bowler_id, p.name
      ORDER BY o.batting_team_id, SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) DESC
    `;

    const [battingRes, bowlingRes] = await Promise.all([
      pool.query(battingQuery, [id]),
      pool.query(bowlingQuery, [id])
    ]);

    // Group stats by team
    const teamStats: Record<number, any> = {};

    // batting stats
    for (const row of battingRes.rows) {
      const teamId = row.team_id;
      if (!teamStats[teamId]) {
        teamStats[teamId] = { batting: [], bowling: [] };
      }

      const strikeRate = row.balls > 0 ? 
        ((parseInt(row.runs) || 0) / parseInt(row.balls) * 100).toFixed(2) : 
        '0.00';

      teamStats[teamId].batting.push({
        playerId: row.player_id,
        playerName: row.player_name,
        runs: parseInt(row.runs) || 0,
        balls: parseInt(row.balls) || 0,
        fours: parseInt(row.fours) || 0,
        sixes: parseInt(row.sixes) || 0,
        timesOut: parseInt(row.times_out) || 0,
        dismissal: row.dismissal,
        strikeRate: parseFloat(strikeRate)
      });
    }

    // bowling stats
    for (const row of bowlingRes.rows) {
      const teamId = row.batting_team_id;
      if (!teamStats[teamId]) {
        teamStats[teamId] = { batting: [], bowling: [] };
      }

      const economy = row.balls > 0 ? 
        ((parseInt(row.runs_conceded) || 0) / parseInt(row.balls) * 6).toFixed(2) : 
        '0.00';

      teamStats[teamId].bowling.push({
        playerId: row.player_id,
        playerName: row.player_name,
        balls: parseInt(row.balls) || 0,
        runsConceded: parseInt(row.runs_conceded) || 0,
        wickets: parseInt(row.wickets) || 0,
        economy: parseFloat(economy),
        foursConceded: parseInt(row.fours_conceded) || 0,
        sixesConceded: parseInt(row.sixes_conceded) || 0
      });
    }

    res.json({
      matchId: parseInt(id),
      teams: teamStats
    });
  } catch (err) {
    console.error("Error fetching player stats:", err);
    res.status(500).send("Server Error");
  }
});

export default router;
