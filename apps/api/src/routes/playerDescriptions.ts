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
			const descs = await prisma.player_descriptions.findMany({ where: { match_id: mId } });

			if (descs.length === 0) {
				return res.json([]);
			}

			const playerIds = Array.from(new Set(descs.map((d: any) => d.player_id)));
			const players = await prisma.players.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } });
			const playerMap: Record<number, string | null> = Object.fromEntries(players.map((p: any) => [p.id, p.name]));

			const result = descs.map((d: any) => ({
				id: d.id,
				match_id: d.match_id,
				player_id: d.player_id,
				description: d.description,
				author: d.author,
				created_at: d.created_at,
				updated_at: d.updated_at,
				player_name: playerMap[d.player_id] ?? null,
			}));

			// sort by player_name NULLS LAST, then updated_at DESC
			result.sort((a: any, b: any) => {
				if (a.player_name === null && b.player_name !== null) return 1;
				if (a.player_name !== null && b.player_name === null) return -1;
				if (a.player_name && b.player_name) {
					const cmp = a.player_name.localeCompare(b.player_name);
					if (cmp !== 0) return cmp;
				}
				return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
			});

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
			const row = await prisma.player_descriptions.findFirst({ where: { match_id: mId, player_id: pId } });
			if (!row) {
				return res.status(404).json({ error: 'Description not found' });
			}
			res.json(row);
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
			// Try update first
			const updateResult = await prisma.player_descriptions.updateMany({
				where: { match_id: mId, player_id: pId },
				data: { description, author: author ?? null, updated_at: new Date() },
			});

			if (updateResult.count && updateResult.count > 0) {
				const updated = await prisma.player_descriptions.findFirst({ where: { match_id: mId, player_id: pId } });
				return res.status(200).json(updated);
			}

			// else create
			const created = await prisma.player_descriptions.create({
				data: { match_id: mId, player_id: pId, description, author: author ?? null },
			});
			res.status(201).json(created);
		} catch (err) {
			console.error('Error saving description:', err);
			res.status(500).json({ error: 'Failed to save description' });
		}
});

export default router;

