import { Router } from "express";
import pool from "../db/connection.js";
import { getIO } from "../server.ts";
import { verifyToken, isSuperadmin, isAdmin, isAuthenticated } from "../middleware/auth.ts";

const router: Router = Router();

//  to determine format based on overs per inning
function getFormatFromOvers(oversPerInning: number): string {
  if (oversPerInning <= 1) return "1over";
  if (oversPerInning <= 20) return "t20";
  if (oversPerInning <= 50) return "odi";
  return "test";
}

// to calculate best bowling for a bowler in a match
async function updateBestBowling(bowlerId: number, teamId: number, format: any, matchId: any) {
  try {
    const bowlingPerformancesQuery = `
      SELECT 
        m.id as match_id,
        SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) as match_wickets,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as match_runs
      FROM matches m
      JOIN overs o ON o.match_id = m.id
      JOIN balls b ON b.over_id = o.id
      WHERE b.bowler_id = $1 
        AND m.format = $2
        AND EXISTS (
          SELECT 1 FROM players p 
          WHERE p.id = $1 AND p.team_id = $3
        )
      GROUP BY m.id
      ORDER BY match_wickets DESC, match_runs ASC
    `;
    
    const result = await pool.query(bowlingPerformancesQuery, [bowlerId, format, teamId]);
    
    console.log(`[BestBowling-DEBUG] Bowler ${bowlerId}, TeamId ${teamId}, Format ${format}: Found ${result.rows.length} matches`);
    
    if (result.rows.length === 0) {
      console.log(`[BestBowling] No bowling records found for bowler ${bowlerId}`);
      return "0/0";
    }
    
    const bestPerf = result.rows[0];
    const bestBowling = `${bestPerf.match_wickets}/${bestPerf.match_runs || 0}`;
    
    console.log(`[BestBowling-DEBUG] Best performance: wickets=${bestPerf.match_wickets}, runs=${bestPerf.match_runs || 0}`);
    
    // Update player_stats with best_bowling
    await pool.query(
      `UPDATE player_stats 
       SET best_bowling = $1, updated_at = NOW()
       WHERE player_id = $2 AND team_id = $3 AND format = $4`,
      [bestBowling, bowlerId, teamId, format]
    );
    
    console.log(`[BestBowling] Updated bowler ${bowlerId}: best_bowling = ${bestBowling} (format: ${format})`);
    return bestBowling;
  } catch (err) {
    console.error("Error updating best bowling:", err);
    return null;
  }
}

// update half_centuries and centuries when a batsman gets out
async function updateBatsmanMilestones(matchId: number, batsmanId: number, battingTeamId: number, format: string, inningNumber: number) {
  try {
    // Calculate batsman's inning score 
    const inningScoreQuery = await pool.query(
      `SELECT SUM(b.runs) as inning_total
       FROM balls b
       JOIN overs o ON b.over_id = o.id
       WHERE o.match_id = $1 AND b.batsman_id = $2 AND o.batting_team_id = $3 AND o.inning_number = $4`,
      [matchId, batsmanId, battingTeamId, inningNumber]
    );
    
    const inningScore = parseInt(inningScoreQuery.rows[0]?.inning_total) || 0;
    
    // Determine if this inning qualifies for half_century or century
    let halfCenturiesToAdd = 0;
    let centuriesToAdd = 0;
    
    // Half-century
    if (inningScore >= 50 && inningScore < 100) {
      halfCenturiesToAdd = 1;
    }
    
    // Century: score is 100+
    if (inningScore >= 100) {
      centuriesToAdd = 1;
    }
    
    if (halfCenturiesToAdd > 0 || centuriesToAdd > 0) {
      // Update player_stats with half_centuries and centuries
      await pool.query(
        `UPDATE player_stats 
         SET half_centuries = half_centuries + $1,
             centuries = centuries + $2,
             updated_at = NOW()
         WHERE player_id = $3 AND team_id = $4 AND format = $5`,
        [halfCenturiesToAdd, centuriesToAdd, batsmanId, battingTeamId, format]
      );
      
      console.log(`[Milestone] Batsman ${batsmanId}: inning_score=${inningScore}, half_centuries+=\${halfCenturiesToAdd}, centuries+=\${centuriesToAdd}`);
    }
  } catch (err) {
    console.error("Error updating batsman milestones:", err);
  }
}

// Helper function to update highest_score, half_centuries, and centuries for all batsmen at end of inning
async function updateHighestScoreForInning(matchId: number, battingTeamId: number, format: any, inningNumber: number) {
  try {
    console.log(`[HighestScore-Inning] Updating highest_score for all batsmen in inning ${inningNumber} (Team ${battingTeamId}, Match ${matchId})`);
    
    // Get all batsmen and their inning scores
    const batsmensQuery = await pool.query(
      `SELECT DISTINCT b.batsman_id, SUM(b.runs) as inning_total
       FROM balls b
       JOIN overs o ON b.over_id = o.id
       WHERE o.match_id = $1 AND o.batting_team_id = $2 AND o.inning_number = $3
       GROUP BY b.batsman_id`,
      [matchId, battingTeamId, inningNumber]
    );
    
    console.log(`[HighestScore-Inning] Found ${batsmensQuery.rows.length} batsmen to update`);
    
    for (const batsman of batsmensQuery.rows) {
      const batsmanId = batsman.batsman_id;
      const inningScore = parseInt(batsman.inning_total) || 0;
      
      // Update highest_score using GREATEST
      await pool.query(
        `UPDATE player_stats 
         SET highest_score = GREATEST(highest_score, $1), updated_at = NOW()
         WHERE player_id = $2 AND team_id = $3 AND format = $4`,
        [inningScore, batsmanId, battingTeamId, format]
      );
      
      console.log(`[HighestScore-Inning] Batsman ${batsmanId}: highest_score updated to at least ${inningScore}`);
    }
  } catch (err) {
    console.error("Error updating highest_score for inning:", err);
  }
}

async function checkAndCompleteMatchIfNeeded(matchId: number) {
  try {
    const matchResult = await pool.query(
      `SELECT m.*, 
              t1.name AS team1_name, 
              t2.name AS team2_name,
              m.inning1_team_id
       FROM matches m
       JOIN teams t1 ON t1.id = m.team1
       JOIN teams t2 ON t2.id = m.team2
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return null;
    }

    const match = matchResult.rows[0];
    
    match.team1 = parseInt(match.team1);
    match.team2 = parseInt(match.team2);
    match.inning1_team_id = match.inning1_team_id ? parseInt(match.inning1_team_id) : null;

    // to determine which inning should trigger completion
    const isTestFormat = match.format === 'test';
    const completionInning = isTestFormat ? 4 : 2;
    
    if (match.current_inning !== completionInning || match.match_status === 'completed') {
      return null;
    }

    // Get current scores for both teams 
    const inning1TeamId = match.inning1_team_id || match.team1;
    const inning2TeamId = inning1TeamId === match.team1 ? match.team2 : match.team1;

    // Query scores for INNING 1 ONLY
    const inning1ScoreQuery = `
      SELECT 
        o.batting_team_id,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
        COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1 AND o.batting_team_id = $2 AND o.inning_number = 1
      GROUP BY o.batting_team_id
    `;

    const inning1Result = await pool.query(inning1ScoreQuery, [matchId, inning1TeamId]);
    let inning1Score = 0;
    let inning1Wickets = 0;
    
    if (inning1Result.rows.length > 0) {
      inning1Score = parseInt(inning1Result.rows[0].total_runs) || 0;
      inning1Wickets = parseInt(inning1Result.rows[0].wickets) || 0;
    }

    const inning2ScoreQuery = `
      SELECT 
        o.batting_team_id,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
        COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1 AND o.batting_team_id = $2 AND o.inning_number = 2
      GROUP BY o.batting_team_id
    `;

    const inning2Result = await pool.query(inning2ScoreQuery, [matchId, inning2TeamId]);
    let inning2Score = 0;
    let inning2Wickets = 0;
    
    if (inning2Result.rows.length > 0) {
      inning2Score = parseInt(inning2Result.rows[0].total_runs) || 0;
      inning2Wickets = parseInt(inning2Result.rows[0].wickets) || 0;
    }

    const allScoresQuery = `
      SELECT 
        o.batting_team_id,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
        COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1
      GROUP BY o.batting_team_id
    `;
    
    const allScoresResult = await pool.query(allScoresQuery, [matchId]);
    let team1TotalScore = 0;
    let team2TotalScore = 0;
    let team1TotalWickets = 0;
    let team2TotalWickets = 0;
    
    for (const row of allScoresResult.rows) {
      const runs = parseInt(row.total_runs) || 0;
      const wickets = parseInt(row.wickets) || 0;

      if (row.batting_team_id === match.team1) {
        team1TotalScore = runs;
        team1TotalWickets = wickets;
      } else if (row.batting_team_id === match.team2) {
        team2TotalScore = runs;
        team2TotalWickets = wickets;
      }
    }

    let shouldComplete = false;
    let winner = null;
    let result_description = null;

    // Ensure wickets are properly converted to numbers
    const inning2WicketsNum = Math.max(0, Math.min(10, parseInt(String(inning2Wickets)) || 0));
    const inning1WicketsNum = Math.max(0, Math.min(10, parseInt(String(inning1Wickets)) || 0));

    // For test format: Calculate cumulative scores from all 4 innings
    if (isTestFormat) {
      // Query inning 3 and inning 4 scores
      const inning3ScoreQuery = `
        SELECT 
          o.batting_team_id,
          SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
          COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets
        FROM overs o
        LEFT JOIN balls b ON b.over_id = o.id
        WHERE o.match_id = $1 AND o.batting_team_id = $2 AND o.inning_number = 3
        GROUP BY o.batting_team_id
      `;
      
      const inning3Result = await pool.query(inning3ScoreQuery, [matchId, inning1TeamId]);
      let inning3Score = 0;
      if (inning3Result.rows.length > 0) {
        inning3Score = parseInt(inning3Result.rows[0].total_runs) || 0;
      }

      const inning4ScoreQuery = `
        SELECT 
          o.batting_team_id,
          SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
          COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets
        FROM overs o
        LEFT JOIN balls b ON b.over_id = o.id
        WHERE o.match_id = $1 AND o.batting_team_id = $2 AND o.inning_number = 4
        GROUP BY o.batting_team_id
      `;
      
      const inning4Result = await pool.query(inning4ScoreQuery, [matchId, inning2TeamId]);
      let inning4Score = 0;
      let inning4Wickets = 0;
      if (inning4Result.rows.length > 0) {
        inning4Score = parseInt(inning4Result.rows[0].total_runs) || 0;
        inning4Wickets = parseInt(inning4Result.rows[0].wickets) || 0;
      }

      // Calculate cumulative scores
      const team1TotalForTest = inning1Score + inning3Score;
      const team2TotalForTest = inning2Score + inning4Score;

      console.log(`[Match-Complete-Test] Inning 1: ${inning1Score}, Inning 3: ${inning3Score}, Team 1 Total: ${team1TotalForTest}`);
      console.log(`[Match-Complete-Test] Inning 2: ${inning2Score}, Inning 4: ${inning4Score}, Team 2 Total: ${team2TotalForTest}`);
      console.log(`[Match-Complete-Test] Inning 4 Wickets: ${inning4Wickets}`);

      // Check if match should complete
      // Match completes only when:
      // 1. Chasing team (inning 4) exceeds target, OR
      // 2. Chasing team (inning 4) is all out (10 wickets), OR
      // 3. All overs completed (checked via inning4_complete flag in match table)
      
      const matchInningStatusQuery = await pool.query(
        `SELECT inning4_complete FROM matches WHERE id = $1`,
        [matchId]
      );
      const inning4Complete = matchInningStatusQuery.rows[0]?.inning4_complete || false;

      // Condition 1: Team 2 exceeded target - they won
      if (team2TotalForTest > team1TotalForTest) {
        shouldComplete = true;
        winner = inning2TeamId;
        const wicketsRemaining = 10 - inning4Wickets;
        const winnerName = inning2TeamId === match.team1 ? match.team1_name : match.team2_name;
        result_description = `${winnerName} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`;
        console.log(`[Match-Complete-Test] ${winnerName} (Team ${inning2TeamId}) won by ${wicketsRemaining} wickets`);
      }
      // Condition 2: Team 2 all out (10 wickets) - match complete based on scores
      else if (inning4Wickets >= 10) {
        shouldComplete = true;
        if (team1TotalForTest > team2TotalForTest) {
          winner = inning1TeamId;
          const margin = team1TotalForTest - team2TotalForTest;
          const winnerName = inning1TeamId === match.team1 ? match.team1_name : match.team2_name;
          result_description = `${winnerName} won by ${margin} run${margin === 1 ? '' : 's'}`;
          console.log(`[Match-Complete-Test] ${winnerName} (Team ${inning1TeamId}) won by ${margin} runs (inning 4 all out)`);
        } else {
          // Equal scores with inning 4 all out - Team 1 wins
          winner = inning1TeamId;
          const winnerName = inning1TeamId === match.team1 ? match.team1_name : match.team2_name;
          result_description = `${winnerName} won (opponents all out with tied score)`;
          console.log(`[Match-Complete-Test] ${winnerName} (Team ${inning1TeamId}) won - Team 2 all out with tied score`);
        }
      }
      // Condition 3: All overs completed (inning4_complete flag set by over completion logic)
      else if (inning4Complete) {
        shouldComplete = true;
        if (team1TotalForTest > team2TotalForTest) {
          winner = inning1TeamId;
          const margin = team1TotalForTest - team2TotalForTest;
          const winnerName = inning1TeamId === match.team1 ? match.team1_name : match.team2_name;
          result_description = `${winnerName} won by ${margin} run${margin === 1 ? '' : 's'}`;
          console.log(`[Match-Complete-Test] ${winnerName} (Team ${inning1TeamId}) won by ${margin} runs (all overs complete)`);
        } else {
          // Equal scores with all overs complete - genuine draw
          winner = null;
          result_description = `Match drawn! Both teams scored ${team1TotalForTest} runs`;
          console.log(`[Match-Complete-Test] Match is a draw! Both teams tied at ${team1TotalForTest} runs`);
        }
      } else {
        // Match is still in progress - don't complete yet
        shouldComplete = false;
        console.log(`[Match-Complete-Test] Match still in progress. Team 2: ${team2TotalForTest}/${inning4Wickets}, Target: ${team1TotalForTest + 1}`);
      }
    } else {
      // Check winning conditions for non-test formats
      // Scenario 1: Chasing team EXCEEDS the target with wickets remaining (must be strictly greater, not equal)
      if (inning2Score > inning1Score && inning2WicketsNum < 10) {
        shouldComplete = true;
        winner = inning2TeamId;
        const wicketsRemaining = 10 - inning2WicketsNum;
        const winnerName = inning2TeamId === match.team1 ? match.team1_name : match.team2_name;
        result_description = `${winnerName} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`;
        console.log(`[Match-Complete] Scenario 1: Chasing team (${inning2TeamId}) scored ${inning2Score} > target ${inning1Score} with ${wicketsRemaining} wickets remaining`);
      }
      // Scenario 2: Chasing team scores more runs but uses all/most wickets (all out but still ahead)
      else if (inning2Score > inning1Score && inning2WicketsNum >= 10) {
        shouldComplete = true;
        winner = inning2TeamId;
        // For a team that's all-out but exceeded the target, show runs margin
        const runMargin = inning2Score - inning1Score;
        const winnerName = inning2TeamId === match.team1 ? match.team1_name : match.team2_name;
        result_description = `${winnerName} won by ${runMargin} run${runMargin === 1 ? '' : 's'}`;
        console.log(`[Match-Complete] Scenario 2: Chasing team (${inning2TeamId}) scored ${inning2Score} > target ${inning1Score} but all out - won by ${runMargin} runs`);
      }
      // Scenario 3: Chasing team all out without reaching target
      else if (inning2WicketsNum >= 10 && inning2Score < inning1Score) {
        shouldComplete = true;
        winner = inning1TeamId;
        const margin = inning1Score - inning2Score;
        const winnerName = inning1TeamId === match.team1 ? match.team1_name : match.team2_name;
        result_description = `${winnerName} won by ${margin} runs`;
        console.log(`[Match-Complete] Scenario 3: Inning 1 team (${inning1TeamId}) wins as chasing team all-out with ${inning2Score} runs`);
      }
    }

    if (shouldComplete) {
      // Update highest_score for both innings before completing match
      const matchDetailsQuery = await pool.query(
        `SELECT format, inning1_team_id FROM matches WHERE id = $1`,
        [matchId]
      );
      const format = matchDetailsQuery.rows[0]?.format;
      const inning1TeamId = parseInt(matchDetailsQuery.rows[0]?.inning1_team_id);
      const inning2TeamId = inning1TeamId === match.team1 ? match.team2 : match.team1;
      
      // Update highest_score for all innings
      if (format === 'test') {
        // Test format: Update all 4 innings
        await updateHighestScoreForInning(matchId, inning1TeamId, format, 1);
        await updateHighestScoreForInning(matchId, inning2TeamId, format, 2);
        await updateHighestScoreForInning(matchId, inning1TeamId, format, 3);
        await updateHighestScoreForInning(matchId, inning2TeamId, format, 4);
      } else {
        // Other formats: Update 2 innings
        await updateHighestScoreForInning(matchId, inning1TeamId, format, 1);
        await updateHighestScoreForInning(matchId, inning2TeamId, format, 2);
      }
      
      // Update match with completion status
      const updateResult = await pool.query(
        `UPDATE matches 
         SET match_status = 'completed', winner = $1, result_description = $2, completed_at = NOW()
         WHERE id = $3 
         RETURNING *`,
        [winner, result_description, matchId]
      );

      // Emit socket event for match completion
      const io = getIO();
      if (io) {
        io.to(`match_${matchId}`).emit("matchComplete", {
          matchId: String(matchId),
          winner,
          result_description,
          team1Score: team1TotalScore,
          team2Score: team2TotalScore,
          team1Wickets: team1TotalWickets,
          team2Wickets: team2TotalWickets,
        });
      }

      return {
        completed: true,
        match: updateResult.rows[0],
        scores: {
          team1: { runs: team1TotalScore, wickets: team1TotalWickets },
          team2: { runs: team2TotalScore, wickets: team2TotalWickets },
        },
        result: result_description,
      };
    }

    return { completed: false };
  } catch (err) {
    console.error("Error checking match completion:", err);
    return null;
  }
}

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
    const format = getFormatFromOvers(overs_per_inning);
    
    // Randomly decide which team bats first in inning 1
    const inning1Team = Math.random() > 0.5 ? team1 : team2;
    
    const result = await pool.query(
      "INSERT INTO matches (team1, team2, date, venue, score, overs_per_inning, current_inning, inning1_complete, match_status, format, inning1_team_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
      [team1, team2, date, venue, score, overs_per_inning, 1, false, 'pending', format, inning1Team]
    );
    
    const matchId = result.rows[0].id;
    
    console.log(`[Match] Created match ${matchId} between team ${team1} and team ${team2}. Team ${inning1Team} will bat first in Inning 1.`);
    
    // Increment match count for all players in both teams
    const playersResult = await pool.query(
      "SELECT id, team_id FROM players WHERE team_id IN ($1, $2)",
      [team1, team2]
    );
    
    console.log(`[Match-Increment] Found ${playersResult.rows.length} players in teams ${team1} and ${team2}`);
    
    // Increment match count for each player in their team's format
    for (const player of playersResult.rows) {
      try {
        const updateResult = await pool.query(
          `INSERT INTO player_stats (player_id, team_id, format, matches_played)
           VALUES ($1, $2, $3, 1)
           ON CONFLICT (player_id, team_id, format) DO UPDATE SET
           matches_played = player_stats.matches_played + 1,
           updated_at = NOW()
           RETURNING matches_played`,
          [player.id, player.team_id, format]
        );
        console.log(`[Match-Increment] Player ${player.id} (Team ${player.team_id}): matches_played = ${updateResult.rows[0]?.matches_played}`);
      } catch (playerErr) {
        console.error(`Error incrementing match count for player ${player.id}:`, playerErr);
      }
    }
    
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
    const format = getFormatFromOvers(overs_per_inning);
    
    const result = await pool.query(
      "UPDATE matches SET team1 = $1, team2 = $2, date = $3, venue = $4, score = $5, overs_per_inning = $6, format = $7 WHERE id = $8 RETURNING *",
      [team1, team2, date, venue, score, overs_per_inning, format, id]
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
       SET inning1_team_id = $1, inning1_complete = true, current_inning = 2, match_status = 'inning2' 
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

// Complete the match after inning 2 - Admin only
router.put("/:id/complete", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Get match details with team names
    const matchResult = await pool.query(
      `SELECT 
        m.*,
        t1.name AS team1_name,
        t2.name AS team2_name
      FROM matches m
      JOIN teams t1 ON t1.id = m.team1
      JOIN teams t2 ON t2.id = m.team2
      WHERE m.id = $1`,
      [id]
    );
    if (matchResult.rows.length === 0) {
      return res.status(404).send("Match not found");
    }
    const match = matchResult.rows[0];

    // Check if match is in correct inning for completion
    const isTestFormat = match.format === 'test';
    const validInning = isTestFormat ? 4 : 2;
    
    if (match.current_inning !== validInning) {
      return res.status(400).json({ 
        error: `Can only complete match in inning ${validInning} for ${match.format} format. Current inning: ${match.current_inning}` 
      });
    }

    if (match.match_status === 'completed') {
      return res.status(400).json({ error: "Match is already completed" });
    }

    // Get scores for both teams
    const scoreQuery = `
      SELECT 
        o.batting_team_id,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
        COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1
      GROUP BY o.batting_team_id
      ORDER BY o.batting_team_id
    `;

    const scoreResult = await pool.query(scoreQuery, [id]);
    
    let team1Score = 0;
    let team2Score = 0;
    let team1Wickets = 0;
    let team2Wickets = 0;

    // For test format, we need to sum scores across all innings per team
    if (isTestFormat) {
      // Team 1 bats in innings 1 and 3
      // Team 2 bats in innings 2 and 4
      const inning1TeamId = match.inning1_team_id || match.team1;
      const inning2TeamId = inning1TeamId === match.team1 ? match.team2 : match.team1;
      
      let inning1Score = 0, inning2Score = 0, inning3Score = 0, inning4Score = 0;
      
      for (const row of scoreResult.rows) {
        const runs = parseInt(row.total_runs) || 0;
        const wickets = parseInt(row.wickets) || 0;

        if (row.batting_team_id === inning1TeamId) {
          // This team batted in innings 1 and 3
          if (inning1Score === 0) {
            inning1Score = runs;
          } else {
            inning3Score = runs;
          }
          team1Wickets += wickets;
        } else if (row.batting_team_id === inning2TeamId) {
          // This team batted in innings 2 and 4
          if (inning2Score === 0) {
            inning2Score = runs;
          } else {
            inning4Score = runs;
          }
          team2Wickets += wickets;
        }
      }
      
      // Calculate cumulative scores
      if (inning1TeamId === match.team1) {
        team1Score = inning1Score + inning3Score;
        team2Score = inning2Score + inning4Score;
      } else {
        team1Score = inning2Score + inning4Score;
        team2Score = inning1Score + inning3Score;
      }
      
      console.log(`[Manual-Complete-Test] Team 1 Total: ${team1Score}, Team 2 Total: ${team2Score}`);
    } else {
      // For non-test formats, simple score aggregation
      for (const row of scoreResult.rows) {
        const runs = parseInt(row.total_runs) || 0;
        const wickets = parseInt(row.wickets) || 0;

        if (row.batting_team_id === match.team1) {
          team1Score = runs;
          team1Wickets = wickets;
        } else if (row.batting_team_id === match.team2) {
          team2Score = runs;
          team2Wickets = wickets;
        }
      }
    }

    // Determine winner
    let winner = null;
    let result_description = "Match Tied";

    if (team1Score > team2Score) {
      winner = match.team1;
      const margin = team1Score - team2Score;
      result_description = `${match.team1_name} won by ${margin} runs`;
    } else if (team2Score > team1Score) {
      winner = match.team2;
      const margin = team2Score - team1Score;
      result_description = `${match.team2_name} won by ${margin} runs`;
    }

    // Update match with completion status and winner
    const updateResult = await pool.query(
      `UPDATE matches 
       SET match_status = 'completed', winner = $1, result_description = $2, completed_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [winner, result_description, id]
    );

    // Emit socket event for match completion
    const io = getIO();
    if (io) {
      io.to(`match_${id}`).emit("matchComplete", {
        matchId: String(id),
        winner,
        result_description,
        team1Score,
        team2Score,
        team1Wickets,
        team2Wickets,
      });
    }

    res.json({
      match: updateResult.rows[0],
      scores: {
        team1: { runs: team1Score, wickets: team1Wickets },
        team2: { runs: team2Score, wickets: team2Wickets },
      },
      result: result_description,
    });
  } catch (err) {
    console.error("Error completing match:", err);
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
    const format = match.format || 'odi';

    // Aggregate scores per team per inning
    const scoreQuery = `
      SELECT 
        o.batting_team_id,
        o.inning_number,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER), 0)) as total_runs,
        COUNT(CASE WHEN b.is_wicket THEN 1 END) as wickets,
        COALESCE(MAX(o.over_number), 1) - 1 as completed_overs,
        MAX(CASE WHEN o.over_number = (SELECT MAX(over_number) FROM overs WHERE match_id = $1 AND batting_team_id = o.batting_team_id AND inning_number = o.inning_number) 
            THEN (SELECT SUM(CASE WHEN NOT ((COALESCE(extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(event,'') ~* '^(wide|wd|no-?ball|nb)')) THEN 1 ELSE 0 END) FROM balls WHERE over_id = o.id) 
            ELSE 0 END) as balls_in_current_over
      FROM overs o
      LEFT JOIN balls b ON b.over_id = o.id
      WHERE o.match_id = $1 AND o.batting_team_id IS NOT NULL
      GROUP BY o.batting_team_id, o.inning_number
      ORDER BY o.inning_number
    `;

    const scoreResult = await pool.query(scoreQuery, [id]);

    const innings = scoreResult.rows.map((row) => {
      let completedOvers = parseInt(row.completed_overs) || 0;
      let ballsInOver = parseInt(row.balls_in_current_over) || 0;

      if (ballsInOver >= 6) {
        completedOvers += Math.floor(ballsInOver / 6);
        ballsInOver = ballsInOver % 6;
      }

      return {
        inningNumber: row.inning_number,
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
      format,
      innings,
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
  
  if (!matchId) {
    return res.status(400).json({ error: "Match ID is required" });
  }
  
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
    // Verify match exists and get current inning
    const matchCheck = await pool.query(
      "SELECT id, match_status, current_inning FROM matches WHERE id = $1",
      [matchId]
    );
    
    if (matchCheck.rows.length === 0) {
      return res.status(404).json({ error: "Match not found" });
    }

    const match = matchCheck.rows[0];
    const currentInning = parseInt(match.current_inning) || 1;

    // Prevent adding balls to completed matches
    if (match.match_status === 'completed') {
      return res.status(400).json({ error: "Match is already completed" });
    }

    // Find or create the over (now with inning_number for proper separation)
    let overResult = await pool.query(
      "SELECT id FROM overs WHERE match_id = $1 AND over_number = $2 AND batting_team_id = $3 AND inning_number = $4",
      [matchId, overNumber, battingTeamId, currentInning]
    );

    let overId;
    if (overResult.rows.length === 0) {
      // Create new over if it doesn't exist (with inning_number for proper tracking)
      const newOver = await pool.query(
        "INSERT INTO overs (match_id, over_number, batting_team_id, inning_number) VALUES ($1, $2, $3, $4) RETURNING id",
        [matchId, overNumber, battingTeamId, currentInning]
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
      io.to(`match_${matchId}`).emit("ballUpdate", payload);
    }

    // Get the ID of the ball we just inserted
    const currentBallId = ballResult.rows[0]?.id;

    // Update player stats for batsman (non-blocking)
    if (batsmanId) {
      try {
        const matchFormatResult = await pool.query(
          "SELECT COALESCE(format, 't20') as format FROM matches WHERE id = $1",
          [matchId]
        );
        const format = matchFormatResult.rows[0]?.format || "t20";

        const runsScored = runs || 0;
        const isFour = runsScored === 4 ? 1 : 0;
        const isSix = runsScored === 6 ? 1 : 0;

        // Calculate batsman's current inning score
        // We need to exclude the current ball and any extras from this delivery
        const batsmanInningScoreQuery = `
          SELECT SUM(b.runs) as inning_runs
          FROM balls b
          JOIN overs o ON b.over_id = o.id
          WHERE o.match_id = $1 AND b.batsman_id = $2 AND o.batting_team_id = $3 AND b.id != $4
        `;
        const inningScoreResult = await pool.query(batsmanInningScoreQuery, [matchId, batsmanId, battingTeamId, currentBallId]);
        const runsBeforeThisBall = parseInt(inningScoreResult.rows[0]?.inning_runs) || 0;
        const inningRunsAfterThisBall = runsBeforeThisBall + runsScored;

        console.log(`[Stats-INNING] Batsman ${batsmanId}: before=${runsBeforeThisBall}, this_ball=${runsScored}, after=${inningRunsAfterThisBall}`);

        // Check if batsman got out or if match is completed
        const matchStatusQuery = await pool.query(
          "SELECT match_status FROM matches WHERE id = $1",
          [matchId]
        );
        const matchStatus = matchStatusQuery.rows[0]?.match_status;
        
        // Get existing highest_score to compare
        const existingStatsQuery = await pool.query(
          "SELECT highest_score FROM player_stats WHERE player_id = $1 AND team_id = $2 AND format = $3",
          [batsmanId, battingTeamId, format]
        );
        const existingHighest = parseInt(existingStatsQuery.rows[0]?.highest_score) || 0;

        // Update highest_score with current inning total using GREATEST
        // This will always track the maximum score in a single inning
        const highestScoreToStore = inningRunsAfterThisBall;

        // Track if batsman got out
        const timesOutIncrement = isWicket ? 1 : 0;

        console.log(`[Stats] Updating batsman ${batsmanId}: +${runsScored} runs, innings_total=${inningRunsAfterThisBall}, isOut=${isWicket}, matchStatus=${matchStatus}, existingHighest=${existingHighest}, newHighest=${highestScoreToStore}`);

        // Upsert batsman stats
        const batsmanResult = await pool.query(
          `INSERT INTO player_stats (player_id, team_id, format, runs_scored, balls_faced, fours, sixes, times_out, highest_score, matches_played)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
           ON CONFLICT (player_id, team_id, format) DO UPDATE SET
           runs_scored = player_stats.runs_scored + $4,
           balls_faced = player_stats.balls_faced + $5,
           fours = player_stats.fours + $6,
           sixes = player_stats.sixes + $7,
           times_out = player_stats.times_out + $8,
           highest_score = GREATEST(player_stats.highest_score, $9),
           updated_at = NOW()`,
          [batsmanId, battingTeamId, format, runsScored, 1, isFour, isSix, timesOutIncrement, highestScoreToStore]
        );

        console.log(`[Stats] Batsman ${batsmanId} updated, affected rows:`, batsmanResult.rowCount);

        // If batsman got out, update milestones (50s and 100s)
        if (isWicket) {
          await updateBatsmanMilestones(parseInt(matchId), batsmanId, battingTeamId, format, currentInning);
        }

        // Emit stats update via socket.io
        if (io) {
          io.to(`match_${matchId}`).emit("statsUpdated", {
            matchId: String(matchId),
            playerId: batsmanId,
            type: "batting",
          });
        }
      } catch (statsErr) {
        console.error("Error updating batsman stats:", statsErr);
      }
    }

    // Update player stats for bowler (non-blocking)
    if (bowlerId) {
      try {
        const matchFormatResult = await pool.query(
          "SELECT COALESCE(format, 't20') as format FROM matches WHERE id = $1",
          [matchId]
        );
        const format = matchFormatResult.rows[0]?.format || "t20";

        // Get bowling team (opposite of batting team)
        const bowlingTeamResult = await pool.query(
          "SELECT CASE WHEN team1 = $1 THEN team2 ELSE team1 END as team_id FROM matches WHERE id = $2",
          [battingTeamId, matchId]
        );
        const bowlingTeamId = bowlingTeamResult.rows[0]?.team_id;

        if (bowlingTeamId) {
          const runsGiven = (runs || 0) + (extras ? parseInt(extras) : 0);
          const wicketCount = isWicket ? 1 : 0;
          
          const ballInOver = ((ballNumber - 1) % 6) + 1; // 1-6
          
          let oversToAdd: number;
          if (ballInOver === 6) {
            oversToAdd = 0.5;
          } else {
            oversToAdd = 0.1;
          }

          // Check if this over is a maiden 
          const overRunsCheck = await pool.query(
            `SELECT SUM(COALESCE(CAST(b.extras AS INTEGER), 0)) as extra_runs,
                    SUM(b.runs) as ball_runs
             FROM balls b
             JOIN overs o ON b.over_id = o.id
             WHERE o.match_id = $1 AND b.bowler_id = $2 AND o.over_number = $3 AND b.id != $4`,
            [matchId, bowlerId, overNumber, currentBallId]
          );
          
          const extraRuns = parseInt(overRunsCheck.rows[0]?.extra_runs) || 0;
          const ballRuns = parseInt(overRunsCheck.rows[0]?.ball_runs) || 0;
          const otherRuns = extraRuns + ballRuns;
          
          // Check if this is the 6th ball (last ball of the over)
          const isMaidenOver = ballInOver === 6 && runsGiven === 0 && otherRuns === 0 && !isWicket;

          console.log(`[Stats-DEBUG] Ball ${ballNumber} in over ${overNumber}: ballInOver=${ballInOver}, oversToAdd=+${oversToAdd.toFixed(1)}`);
          console.log(`[Stats] Updating bowler ${bowlerId}: +${runsGiven} runs, +${wicketCount} wickets, +${oversToAdd.toFixed(1)} overs (Team ${bowlingTeamId}, Format ${format}), maiden=${isMaidenOver}`);

          
          const bowlerResult = await pool.query(
            `INSERT INTO player_stats (player_id, team_id, format, runs_conceded, overs_bowled, wickets_taken, maidens, matches_played)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
             ON CONFLICT (player_id, team_id, format) DO UPDATE SET
             runs_conceded = player_stats.runs_conceded + $4,
             overs_bowled = ROUND((player_stats.overs_bowled::numeric + $5::numeric)::numeric, 1),
             wickets_taken = player_stats.wickets_taken + $6,
             maidens = player_stats.maidens + $7,
             updated_at = NOW()`,
            [bowlerId, bowlingTeamId, format, runsGiven, oversToAdd, wicketCount, isMaidenOver ? 1 : 0]
          );

          console.log(`[Stats] Bowler ${bowlerId} updated, affected rows:`, bowlerResult.rowCount);

          // Update best bowling for this bowler
          await updateBestBowling(parseInt(bowlerId), bowlingTeamId, format, matchId);

          // Emit stats update via socket.io
          if (io) {
            io.to(`match_${matchId}`).emit("statsUpdated", {
              matchId: String(matchId),
              playerId: bowlerId,
              type: "bowling",
            });
          }
        }
      } catch (statsErr) {
        console.error("Error updating bowler stats:", statsErr);
      }
    }

    // Check if batting team is all out 
    if (isWicket) {
      try {
        const wicketsInInningQuery = await pool.query(
          `SELECT COUNT(CASE WHEN b.is_wicket THEN 1 END) as total_wickets
           FROM balls b
           JOIN overs o ON b.over_id = o.id
           WHERE o.match_id = $1 AND o.batting_team_id = $2 AND o.inning_number = $3`,
          [matchId, battingTeamId, currentInning]
        );
        const totalWicketsInInning = parseInt(wicketsInInningQuery.rows[0]?.total_wickets) || 0;

        // If 10 wickets have fallen, end the inning
        if (totalWicketsInInning >= 10) {
          console.log(`[AllOut] Team ${battingTeamId} is ALL OUT! Wickets: ${totalWicketsInInning}`);
          
          // Get match details
          const matchCheckQuery = await pool.query(
            `SELECT m.current_inning, m.team1, m.team2, m.inning1_team_id, m.format
             FROM matches m
             WHERE m.id = $1`,
            [matchId]
          );
          
          const currentInning = matchCheckQuery.rows[0]?.current_inning;
          const format = matchCheckQuery.rows[0]?.format;
          const team1 = parseInt(matchCheckQuery.rows[0]?.team1);
          const team2 = parseInt(matchCheckQuery.rows[0]?.team2);
          const inning1TeamId = parseInt(matchCheckQuery.rows[0]?.inning1_team_id);
          
          // inning2TeamId is the other team
          const inning2TeamId = inning1TeamId === team1 ? team2 : team1;
          // For test format
          const inning3TeamId = inning1TeamId;
          const inning4TeamId = inning2TeamId;

          console.log(`[AllOut-DEBUG] battingTeamId=${battingTeamId}, team1=${team1}, team2=${team2}, inning1TeamId=${inning1TeamId}, inning2TeamId=${inning2TeamId}, format=${format}, currentInning=${currentInning}`);

          // Get match format for conditional logic
          const isTestFormat = format === 'test';

          if (currentInning === 1) {
            // Inning 1 complete, mark it and move to inning 2
            const updateResult = await pool.query(
              `UPDATE matches 
               SET inning1_complete = true, current_inning = 2, inning2_team_id = $1
               WHERE id = $2
               RETURNING *`,
              [inning2TeamId, matchId]
            );
            
            // Update highest_score for all batsmen in this inning
            const battingTeamIdNum = parseInt(battingTeamId as any);
            await updateHighestScoreForInning(parseInt(matchId), battingTeamIdNum, format, 1);
            
            console.log(`[AllOut] Inning 1 ended. Moving to Inning 2. Team ${inning2TeamId} will bat now.`);

            // Emit socket event using existing io
            if (io) {
              io.to(`match_${matchId}`).emit("inningEnd", {
                matchId: String(matchId),
                inning: 1,
                message: `Inning 1 complete - Team all out!`,
                nextInningTeam: inning2TeamId,
              });
            }
            
            return res.status(201).json({
              completed: false,
              inningEnded: true,
              inning: 1,
              match: updateResult.rows[0],
            });
          } else if (currentInning === 2) {
            // Update highest_score for all batsmen in inning 2
            const battingTeamIdNum = parseInt(battingTeamId as any);
            await updateHighestScoreForInning(parseInt(matchId), battingTeamIdNum, format, 2);

            if (isTestFormat) {
              // Test format: Move to inning 3 (Team 1 gets another chance)
              const updateResult = await pool.query(
                `UPDATE matches 
                 SET inning2_complete = true, current_inning = 3, inning3_team_id = $1
                 WHERE id = $2
                 RETURNING *`,
                [inning3TeamId, matchId]
              );
              
              console.log(`[AllOut-Test] Inning 2 ended. Moving to Inning 3. Team ${inning3TeamId} will bat now.`);

              if (io) {
                io.to(`match_${matchId}`).emit("inningEnd", {
                  matchId: String(matchId),
                  inning: 2,
                  message: `Inning 2 complete! Moving to Inning 3...`,
                  nextInningTeam: inning3TeamId,
                  nextInning: 3,
                });
              }
              
              return res.status(201).json({
                completed: false,
                inningEnded: true,
                inning: 2,
                match: updateResult.rows[0],
              });
            } else {
              // Other formats: Complete match - team from inning 1 wins
              const resultDescription = `${inning1TeamId === team1 ? 'Team 1' : 'Team 2'} won (inning 2 all out)`;

              const updateResult = await pool.query(
                `UPDATE matches 
                 SET match_status = 'completed', winner = $1, result_description = $2, completed_at = NOW()
                 WHERE id = $3
                 RETURNING *`,
                [inning1TeamId, resultDescription, matchId]
              );

              console.log(`[AllOut] Inning 2 All-Out! Match completed: ${resultDescription}`);

              if (io) {
                io.to(`match_${matchId}`).emit("matchComplete", {
                  matchId: String(matchId),
                  message: resultDescription,
                  winner: inning1TeamId,
                });
              }
              
              return res.status(201).json({
                completed: true,
                match: updateResult.rows[0],
                result: resultDescription,
              });
            }
          } else if (currentInning === 3 && isTestFormat) {
            // Update highest_score for all batsmen in inning 3
            const battingTeamIdNum = parseInt(battingTeamId as any);
            await updateHighestScoreForInning(parseInt(matchId), battingTeamIdNum, format, 3);
            
            // Inning 3 complete - move to inning 4
            const updateResult = await pool.query(
              `UPDATE matches 
               SET inning3_complete = true, current_inning = 4, inning4_team_id = $1
               WHERE id = $2
               RETURNING *`,
              [inning4TeamId, matchId]
            );
            
            console.log(`[AllOut-Test] Inning 3 ended. Moving to Inning 4. Team ${inning4TeamId} will bat now.`);

            if (io) {
              io.to(`match_${matchId}`).emit("inningEnd", {
                matchId: String(matchId),
                inning: 3,
                message: `Inning 3 complete! Moving to Inning 4...`,
                nextInningTeam: inning4TeamId,
                nextInning: 4,
              });
            }
            
            return res.status(201).json({
              completed: false,
              inningEnded: true,
              inning: 3,
              match: updateResult.rows[0],
            });
          } else if (currentInning === 4 && isTestFormat) {
            // Update highest_score for all batsmen in inning 4
            const battingTeamIdNum = parseInt(battingTeamId as any);
            await updateHighestScoreForInning(parseInt(matchId), battingTeamIdNum, format, 4);
            
            // Inning 4 complete - match will auto-complete via checkAndCompleteMatchIfNeeded
            const updateResult = await pool.query(
              `UPDATE matches 
               SET inning4_complete = true
               WHERE id = $1
               RETURNING *`,
              [matchId]
            );
            
            console.log(`[AllOut-Test] Inning 4 ended. All innings complete. Match will be auto-completed based on final scores.`);

            if (io) {
              io.to(`match_${matchId}`).emit("inningEnd", {
                matchId: String(matchId),
                inning: 4,
                message: `Inning 4 complete! All innings done. Calculating winner...`,
                matchEnding: true,
              });
            }
            
            return res.status(201).json({
              completed: false,
              inningEnded: true,
              inning: 4,
              match: updateResult.rows[0],
            });
          }
        }
      } catch (allOutErr) {
        console.error("[AllOut-Error] Error checking all-out status:", allOutErr);
      }
    }

    // Check if match should auto-complete 
    const completionCheck = await checkAndCompleteMatchIfNeeded(parseInt(matchId));
    if (completionCheck && completionCheck.completed) {
      // Match was auto-completed
      return res.status(200).json(completionCheck);
    }

    res.status(201).json(ballResult.rows[0]);
  } catch (err) {
    console.error("Error adding ball:", err);
    res.status(500).send("Server Error");
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
    // Get match format to determine inning structure
    const matchFormatQuery = await pool.query(
      `SELECT format FROM matches WHERE id = $1`,
      [id]
    );
    const format = matchFormatQuery.rows[0]?.format || 'odi';
    const isTestFormat = format === 'test';
    
    // Batting aggregates per batting team, inning, and batsman
    const battingQuery = `
      SELECT o.batting_team_id AS team_id,
             o.inning_number,
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
      GROUP BY o.batting_team_id, o.inning_number, b.batsman_id, p.name
      ORDER BY o.batting_team_id, o.inning_number, SUM(b.runs) DESC;
    `;

    // Dismissals: earliest wicket ball per dismissed batsman per inning
    const dismissalsQuery = `
      SELECT o.batting_team_id AS team_id,
             o.inning_number,
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

    // Bowling aggregates (as bowler vs batting team per inning)
    const bowlingQuery = `
      SELECT o.batting_team_id AS batting_team_id,
             o.inning_number,
             b.bowler_id,
             p.name AS bowler_name,
             COUNT(*) FILTER (WHERE NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)'))) AS balls,
             SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER),0)) AS runs_conceded,
             SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) AS wickets
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players p ON b.bowler_id = p.id
      WHERE o.match_id = $1 AND b.bowler_id IS NOT NULL
      GROUP BY o.batting_team_id, o.inning_number, b.bowler_id, p.name
      ORDER BY o.batting_team_id, o.inning_number, SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) DESC;
    `;

    // Extras and totals per batting team per inning
    const totalsQuery = `
      SELECT o.batting_team_id AS team_id,
             o.inning_number,
             SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER),0)) AS total_runs,
             SUM(COALESCE(CAST(b.extras AS INTEGER),0)) AS extras,
             SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) AS wickets,
             SUM(CASE WHEN NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)')) THEN 1 ELSE 0 END) AS balls
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      WHERE o.match_id = $1
      GROUP BY o.batting_team_id, o.inning_number
      ORDER BY o.batting_team_id, o.inning_number;
    `;

    // Determine striker per batting team per inning
    const strikerQuery = `
      SELECT DISTINCT ON (o.batting_team_id, o.inning_number)
        o.batting_team_id AS team_id,
        o.inning_number,
        b.batsman_id AS striker_id
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      WHERE o.match_id = $1 AND b.batsman_id IS NOT NULL
      ORDER BY o.batting_team_id, o.inning_number, b.id DESC
    `;

    const [batRes, disRes, bowlRes, totalsRes, strikerRes] = await Promise.all([
      pool.query(battingQuery, [id]),
      pool.query(dismissalsQuery, [id]),
      pool.query(bowlingQuery, [id]),
      pool.query(totalsQuery, [id]),
      pool.query(strikerQuery, [id]),
    ]);

    // Map striker by team_id + inning_number
    const strikerMap: Record<string, number> = {};
    for (const r of strikerRes.rows) {
      const key = `${r.team_id}_${r.inning_number}`;
      strikerMap[key] = r.striker_id;
    }

    // Map dismissals by team_id + inning_number + batsman_id to the earliest dismissal
    const dismissalMap: Record<string, any> = {};
    for (const r of disRes.rows) {
      const key = `${r.team_id}_${r.inning_number}_${r.batsman_id}`;
      if (!dismissalMap[key])
        dismissalMap[key] = { event: r.event, bowlerName: r.bowler_name };
    }

    // Group batting rows per inning 
    const innings: Record<number, any> = {};
    for (const r of batRes.rows) {
      const teamId = r.team_id;
      const inningNum = r.inning_number;
      if (!innings[inningNum])
        innings[inningNum] = { teamId, batting: [], bowling: [], totals: null };
      
      const strikerKey = `${teamId}_${inningNum}`;
      const dismissKey = `${teamId}_${inningNum}_${r.batsman_id}`;
      const dismiss = dismissalMap[dismissKey];
      const notOut = !dismiss;
      const dismissalText = dismiss
        ? dismiss.event
          ? String(dismiss.event)
          : `b ${dismiss.bowlerName || "Unknown"}`
        : "not out";
      innings[inningNum].batting.push({
        playerId: r.batsman_id,
        playerName: r.batsman_name,
        runs: parseInt(r.runs) || 0,
        balls: parseInt(r.balls) || 0,
        fours: parseInt(r.fours) || 0,
        sixes: parseInt(r.sixes) || 0,
        dismissal: dismissalText,
        notOut,
        isStriker: strikerMap[strikerKey] === r.batsman_id,
      });
    }

    // Attach bowling lists per inning
    for (const r of bowlRes.rows) {
      const inningNum = r.inning_number;
      if (!innings[inningNum])
        innings[inningNum] = { teamId: r.batting_team_id, batting: [], bowling: [], totals: null };
      innings[inningNum].bowling.push({
        playerId: r.bowler_id,
        playerName: r.bowler_name,
        balls: parseInt(r.balls) || 0,
        runsConceded: parseInt(r.runs_conceded) || 0,
        wickets: parseInt(r.wickets) || 0,
      });
    }

    // Attach totals per inning
    for (const r of totalsRes.rows) {
      const inningNum = r.inning_number;
      if (!innings[inningNum])
        innings[inningNum] = { teamId: r.team_id, batting: [], bowling: [], totals: null };
      innings[inningNum].totals = {
        totalRuns: parseInt(r.total_runs) || 0,
        extras: parseInt(r.extras) || 0,
        wickets: parseInt(r.wickets) || 0,
        balls: parseInt(r.balls) || 0,
      };
    }

    res.json({ matchId: Number(id), format, innings });
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

// Get player stats for all players in a match
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
