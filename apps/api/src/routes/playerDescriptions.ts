import { Router } from 'express';
import pool from '../db/connection.js';

const router: Router = Router();

// List descriptions for a match
router.get('/matches/:matchId/descriptions', async (req, res) => {
	const { matchId } = req.params;
	const mId = Number(matchId);
	if (!Number.isInteger(mId)) return res.status(400).send('Invalid match id');
	try {
		const q = `
			SELECT pd.id, pd.match_id, pd.player_id, pd.description, pd.author, pd.created_at, pd.updated_at,
						 p.name as player_name
			FROM player_descriptions pd
			LEFT JOIN players p ON p.id = pd.player_id
			WHERE pd.match_id = $1
			ORDER BY p.name NULLS LAST, pd.updated_at DESC
		`;
		const result = await pool.query(q, [mId]);
		res.json(result.rows);
	} catch (err) {
		console.error('Error fetching player descriptions:', err);
		res.status(500).send('Server Error');
	}
});

// Get single player description for a match
router.get('/matches/:matchId/players/:playerId/description', async (req, res) => {
	const { matchId, playerId } = req.params;
	const mId = Number(matchId);
	const pId = Number(playerId);
	if (!Number.isInteger(mId) || !Number.isInteger(pId)) return res.status(400).send('Invalid match or player id');
	try {
		const q = `SELECT * FROM player_descriptions WHERE match_id = $1 AND player_id = $2 LIMIT 1`;
		const result = await pool.query(q, [mId, pId]);
		if (result.rows.length === 0) return res.status(404).send('Not found');
		res.json(result.rows[0]);
	} catch (err) {
		console.error('Error fetching description:', err);
		res.status(500).send('Server Error');
	}
});

// Create or update a player description (upsert)
router.post('/matches/:matchId/players/:playerId/description', async (req, res) => {
	const { matchId, playerId } = req.params;
	const { description, author } = req.body;
	if (!description || String(description).trim().length === 0) return res.status(400).send('Description is required');
	const mId = Number(matchId);
	const pId = Number(playerId);
	if (!Number.isInteger(mId) || !Number.isInteger(pId)) return res.status(400).send('Invalid match or player id');
	try {
		const q = `
			INSERT INTO player_descriptions (match_id, player_id, description, author)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (match_id, player_id) DO UPDATE
				SET description = EXCLUDED.description,
						author = EXCLUDED.author,
						updated_at = now()
			RETURNING *
		`;
		const result = await pool.query(q, [mId, pId, description, author || null]);
		res.status(201).json(result.rows[0]);
	} catch (err) {
		console.error('Error saving description:', err);
		res.status(500).send('Server Error');
	}
});

export default router;

