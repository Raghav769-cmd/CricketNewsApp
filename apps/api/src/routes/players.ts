import { Router } from 'express';
import pool from '../db/connection.js';

const router: Router = Router();

// Get all players
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM players');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Get a specific player by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM players WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Player not found');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Add a new player
router.post('/', async (req, res) => {
  const { name, team_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO players (name, team_id) VALUES ($1, $2) RETURNING *',
      [name, team_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Update a player
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, team_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE players SET name = $1, team_id = $2 WHERE id = $3 RETURNING *',
      [name, team_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Player not found');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Delete a player
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM players WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Player not found');
    }
    res.json({ message: 'Player deleted successfully', player: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Get player stats for a specific match
router.get('/:playerId/match/:matchId/stats', async (req, res) => {
  const { playerId, matchId } = req.params;
  try {
    const playerRes = await pool.query('SELECT id, name, team_id FROM players WHERE id = $1', [playerId]);
    if (playerRes.rows.length === 0) {
      return res.status(404).send('Player not found');
    }
    const player = playerRes.rows[0];

    // Batting stats
    const battingQuery = `
      SELECT 
        b.batsman_id,
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
      WHERE o.match_id = $1 AND b.batsman_id = $2
      GROUP BY b.batsman_id, p.name
    `;

    // Bowling stats
    const bowlingQuery = `
      SELECT 
        b.bowler_id,
        p.name AS player_name,
        COUNT(*) FILTER (WHERE NOT ((COALESCE(b.extras,'0') ~* '^(wide|wd|no-?ball|nb)') OR (COALESCE(b.event,'') ~* '^(wide|wd|no-?ball|nb)'))) AS balls,
        SUM(b.runs + COALESCE(CAST(b.extras AS INTEGER),0)) AS runs_conceded,
        SUM(CASE WHEN b.is_wicket THEN 1 ELSE 0 END) AS wickets,
        COUNT(*) FILTER (WHERE b.runs = 4) AS fours_conceded,
        COUNT(*) FILTER (WHERE b.runs = 6) AS sixes_conceded
      FROM balls b
      JOIN overs o ON b.over_id = o.id
      LEFT JOIN players p ON b.bowler_id = p.id
      WHERE o.match_id = $1 AND b.bowler_id = $2
      GROUP BY b.bowler_id, p.name
    `;

    const [battingRes, bowlingRes] = await Promise.all([
      pool.query(battingQuery, [matchId, playerId]),
      pool.query(bowlingQuery, [matchId, playerId])
    ]);

    const batting = battingRes.rows.length > 0 ? {
      runs: parseInt(battingRes.rows[0].runs) || 0,
      balls: parseInt(battingRes.rows[0].balls) || 0,
      fours: parseInt(battingRes.rows[0].fours) || 0,
      sixes: parseInt(battingRes.rows[0].sixes) || 0,
      timesOut: parseInt(battingRes.rows[0].times_out) || 0,
      dismissal: battingRes.rows[0].dismissal || null,
      strikeRate: (battingRes.rows[0].balls > 0) ? 
        ((parseInt(battingRes.rows[0].runs) || 0) / parseInt(battingRes.rows[0].balls) * 100).toFixed(2) : 
        '0.00'
    } : null;

    const bowling = bowlingRes.rows.length > 0 ? {
      balls: parseInt(bowlingRes.rows[0].balls) || 0,
      runsConceded: parseInt(bowlingRes.rows[0].runs_conceded) || 0,
      wickets: parseInt(bowlingRes.rows[0].wickets) || 0,
      economy: (bowlingRes.rows[0].balls > 0) ? 
        ((parseInt(bowlingRes.rows[0].runs_conceded) || 0) / (parseInt(bowlingRes.rows[0].balls) || 0) * 6).toFixed(2) : 
        '0.00',
      foursConceded: parseInt(bowlingRes.rows[0].fours_conceded) || 0,
      sixesConceded: parseInt(bowlingRes.rows[0].sixes_conceded) || 0
    } : null;

    res.json({
      playerId: parseInt(playerId),
      playerName: player.name,
      teamId: player.team_id,
      matchId: parseInt(matchId),
      batting,
      bowling
    });
  } catch (err) {
    console.error('Error fetching player match stats:', err);
    res.status(500).send('Server Error');
  }
});

export default router;