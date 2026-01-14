import { Router } from 'express';
import { prisma } from '../db/connection.js';
import { verifyToken, isAdmin } from '../middleware/auth.ts';

const router: Router = Router();

// List descriptions for a match
router.get('/matches/:matchId/descriptions', async (req, res) => {
	const { matchId } = req.params;
	const mId = Number(matchId);
	if (!Number.isInteger(mId)) {
		return res.status(400).json({ error: 'Invalid match ID' });
	}
	try {
		const result = await prisma.$queryRaw<any[]>`
			SELECT pd.id, pd.match_id, pd.player_id, pd.description, pd.author, pd.created_at, pd.updated_at,
						 p.name as player_name
			FROM player_descriptions pd
			LEFT JOIN players p ON p.id = pd.player_id
			WHERE pd.match_id = ${mId}
			ORDER BY p.name NULLS LAST, pd.updated_at DESC
		`;
		res.json(result);
	} catch (err) {
		console.error('Error fetching player descriptions:', err);
		res.status(500).json({ error: 'Failed to fetch player descriptions' });
	}
});

// Get single player description for a match
router.get('/matches/:matchId/players/:playerId/description', async (req, res) => {
	const { matchId, playerId } = req.params;
	const mId = Number(matchId);
	const pId = Number(playerId);
	if (!Number.isInteger(mId) || !Number.isInteger(pId)) {
		return res.status(400).json({ error: 'Invalid match or player ID' });
	}
	try {
		const result = await prisma.$queryRaw<any[]>`
			SELECT * FROM player_descriptions WHERE match_id = ${mId} AND player_id = ${pId} LIMIT 1
		`;
		if (result.length === 0) {
			return res.status(404).json({ error: 'Description not found' });
		}
		res.json(result[0]);
	} catch (err) {
		console.error('Error fetching description:', err);
		res.status(500).json({ error: 'Failed to fetch description' });
	}
});

// Create or update a player description - Admin only
router.post('/matches/:matchId/players/:playerId/description', verifyToken, isAdmin, async (req, res) => {
	const { matchId, playerId } = req.params;
	const { description, author } = req.body;
	
	if (!description || String(description).trim().length === 0) {
		return res.status(400).json({ error: 'Description is required' });
	}
	
	const mId = Number(matchId);
	const pId = Number(playerId);
	if (!Number.isInteger(mId) || !Number.isInteger(pId)) {
		return res.status(400).json({ error: 'Invalid match or player ID' });
	}
	
	try {
		const result = await prisma.$queryRaw<any[]>`
			INSERT INTO player_descriptions (match_id, player_id, description, author)
			VALUES (${mId}, ${pId}, ${description}, ${author || null})
			ON CONFLICT (match_id, player_id) DO UPDATE
				SET description = EXCLUDED.description,
						author = EXCLUDED.author,
						updated_at = now()
			RETURNING *
		`;
		res.status(201).json(result[0]);
	} catch (err) {
		console.error('Error saving description:', err);
		res.status(500).json({ error: 'Failed to save description' });
	}
});

export default router;

