import { Router } from 'express';
import { prisma } from '../db/connection.js';

const router: Router = Router();

// Get all players
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.players.findMany();
    const result = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      team_id: r.team_id,
    }));
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
    const row = await prisma.players.findUnique({ where: { id: pId } });
    if (!row) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const result = { id: row.id, name: row.name, team_id: row.team_id };
    res.json(result);
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
    const teamExists = await prisma.teams.findUnique({ where: { id: team_id } });
    if (!teamExists) {
      return res.status(400).json({ error: 'Team not found' });
    }
    const row = await prisma.players.create({ data: { name, team_id } });
    const result = { id: row.id, name: row.name, team_id: row.team_id };
    res.status(201).json(result);
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
    const [playerExists, teamExists] = await Promise.all([
      prisma.players.findUnique({ where: { id: pId } }),
      prisma.teams.findUnique({ where: { id: team_id } }),
    ]);
    if (!playerExists) {
      return res.status(404).json({ error: 'Player not found' });
    }
    if (!teamExists) {
      return res.status(400).json({ error: 'Team not found' });
    }
    const row = await prisma.players.update({ where: { id: pId }, data: { name, team_id } });
    const result = { id: row.id, name: row.name, team_id: row.team_id };
    res.json(result);
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
    const row = await prisma.players.delete({ where: { id: pId } });
    const player = { id: row.id, name: row.name, team_id: row.team_id };
    res.json({ message: 'Player deleted successfully', player });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Player not found' });
    }
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
    const player = await prisma.players.findUnique({ where: { id: pId } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Fetch all balls for this match to compute batting and bowling stats
    const overs = await prisma.overs.findMany({ where: { match_id: mId }, select: { id: true } });
    const overIds = overs.map((o: any) => o.id);
    
    const balls = await prisma.balls.findMany({
      where: { over_id: { in: overIds } },
    });

    // Compute batting stats (batsman_id == pId)
    const battingBalls = balls.filter((b: any) => b.batsman_id === pId);
    let batting = null;
    if (battingBalls.length > 0) {
      const runs = battingBalls.reduce((sum: number, b: any) => sum + (b.runs || 0), 0);
      // count balls that are NOT extras (wide, nb, wd)
      const ballsFaced = battingBalls.filter((b: any) => {
        const extras = b.extras ? String(b.extras).trim() : '';
        const event = b.event ? String(b.event).trim() : '';
        const isExtra = /^(wide|wd|no-?ball|nb)/.test(extras) || /^(wide|wd|no-?ball|nb)/.test(event);
        return !isExtra;
      }).length;
      const fours = battingBalls.filter((b: any) => b.runs === 4).length;
      const sixes = battingBalls.filter((b: any) => b.runs === 6).length;
      const timesOut = battingBalls.filter((b: any) => b.is_wicket).length;
      const dismissal = battingBalls.find((b: any) => b.is_wicket)?.event || null;
      const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(2) : '0.00';
      batting = { runs, balls: ballsFaced, fours, sixes, timesOut, dismissal, strikeRate };
    }

    // Compute bowling stats (bowler_id == pId)
    const bowlingBalls = balls.filter((b: any) => b.bowler_id === pId);
    let bowling = null;
    if (bowlingBalls.length > 0) {
      // count balls that are NOT extras
      const ballsBowled = bowlingBalls.filter((b: any) => {
        const extras = b.extras ? String(b.extras).trim() : '';
        const event = b.event ? String(b.event).trim() : '';
        const isExtra = /^(wide|wd|no-?ball|nb)/.test(extras) || /^(wide|wd|no-?ball|nb)/.test(event);
        return !isExtra;
      }).length;
      const runsConceded = bowlingBalls.reduce((sum: number, b: any) => {
        const extras = b.extras ? parseInt(String(b.extras)) : 0;
        return sum + (b.runs || 0) + extras;
      }, 0);
      const wickets = bowlingBalls.filter((b: any) => b.is_wicket).length;
      const economy = ballsBowled > 0 ? ((runsConceded / ballsBowled) * 6).toFixed(2) : '0.00';
      const foursConceded = bowlingBalls.filter((b: any) => b.runs === 4).length;
      const sixesConceded = bowlingBalls.filter((b: any) => b.runs === 6).length;
      bowling = { balls: ballsBowled, runsConceded, wickets, economy, foursConceded, sixesConceded };
    }

    res.json({
      playerId: pId,
      playerName: player.name,
      teamId: player.team_id,
      matchId: mId,
      batting,
      bowling,
    });
  } catch (err) {
    console.error('Error fetching player match stats:', err);
    res.status(500).json({ error: 'Failed to fetch player match stats' });
  }
});

export default router;