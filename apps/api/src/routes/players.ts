import { Router } from 'express';
import { prisma } from '../db/connection.js';

const router: Router = Router();

// Get all players
router.get('/', async (req, res) => {
  try {
    const result = await prisma.$queryRaw<any[]>`SELECT * FROM players`;
    res.json(result);
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get a specific player by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const pId = parseInt(id);

  if (isNaN(pId)) {
    return res.status(400).json({ error: 'Invalid player ID' });
  }

  try {
    const result = await prisma.$queryRaw<any[]>`SELECT * FROM players WHERE id = ${pId}`;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(result[0]);
  } catch (err) {
    console.error('Error fetching player:', err);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Add a new player
router.post('/', async (req, res) => {
  const { name, team_id } = req.body;
  try {
    if (!name || !team_id) {
      return res.status(400).json({ error: 'Name and team_id are required' });
    }
    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO players (name, team_id) VALUES (${name}, ${team_id}) RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Error creating player:', err);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Update a player
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, team_id } = req.body;
  const pId = parseInt(id);

  if (isNaN(pId)) {
    return res.status(400).json({ error: 'Invalid player ID' });
  }

  try {
    if (!name || !team_id) {
      return res.status(400).json({ error: 'Name and team_id are required' });
    }
    const result = await prisma.$queryRaw<any[]>`
      UPDATE players SET name = ${name}, team_id = ${team_id} WHERE id = ${pId} RETURNING *
    `;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(result[0]);
  } catch (err) {
    console.error('Error updating player:', err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete a player
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const pId = parseInt(id);

  if (isNaN(pId)) {
    return res.status(400).json({ error: 'Invalid player ID' });
  }

  try {
    const result = await prisma.$queryRaw<any[]>`DELETE FROM players WHERE id = ${pId} RETURNING *`;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ message: 'Player deleted successfully', player: result[0] });
  } catch (err) {
    console.error('Error deleting player:', err);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// Get player stats for a specific match
router.get('/:playerId/match/:matchId/stats', async (req, res) => {
  const { playerId, matchId } = req.params;
  const pId = parseInt(playerId);
  const mId = parseInt(matchId);

  if (isNaN(pId) || isNaN(mId)) {
    return res.status(400).json({ error: 'Invalid player ID or match ID' });
  }

  try {
    const playerRes = await prisma.$queryRaw<any[]>`
      SELECT id, name, team_id FROM players WHERE id = ${pId}
    `;
    if (playerRes.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerRes[0];

    // Batting stats
    const [battingRes, bowlingRes] = await Promise.all([
      prisma.$queryRaw<any[]>`
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
        WHERE o.match_id = ${mId} AND b.batsman_id = ${pId}
        GROUP BY b.batsman_id, p.name
      `,
      prisma.$queryRaw<any[]>`
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
        WHERE o.match_id = ${mId} AND b.bowler_id = ${pId}
        GROUP BY b.bowler_id, p.name
      `
    ]);

    const batting = battingRes.length > 0 ? {
      runs: parseInt(battingRes[0].runs) || 0,
      balls: parseInt(battingRes[0].balls) || 0,
      fours: parseInt(battingRes[0].fours) || 0,
      sixes: parseInt(battingRes[0].sixes) || 0,
      timesOut: parseInt(battingRes[0].times_out) || 0,
      dismissal: battingRes[0].dismissal || null,
      strikeRate: (battingRes[0].balls > 0) ? 
        ((parseInt(battingRes[0].runs) || 0) / parseInt(battingRes[0].balls) * 100).toFixed(2) : 
        '0.00'
    } : null;

    const bowling = bowlingRes.length > 0 ? {
      balls: parseInt(bowlingRes[0].balls) || 0,
      runsConceded: parseInt(bowlingRes[0].runs_conceded) || 0,
      wickets: parseInt(bowlingRes[0].wickets) || 0,
      economy: (bowlingRes[0].balls > 0) ? 
        ((parseInt(bowlingRes[0].runs_conceded) || 0) / (parseInt(bowlingRes[0].balls) || 0) * 6).toFixed(2) : 
        '0.00',
      foursConceded: parseInt(bowlingRes[0].fours_conceded) || 0,
      sixesConceded: parseInt(bowlingRes[0].sixes_conceded) || 0
    } : null;

    res.json({
      playerId: pId,
      playerName: player.name,
      teamId: player.team_id,
      matchId: mId,
      batting,
      bowling
    });
  } catch (err) {
    console.error('Error fetching player match stats:', err);
    res.status(500).json({ error: 'Failed to fetch player match stats' });
  }
});

export default router;