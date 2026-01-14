import { Router } from 'express';
import { prisma } from '../db/connection.js';

const router: Router = Router();

// get all teams
router.get('/', async (req, res) => {
  try {
    const result = await prisma.$queryRaw<any[]>`SELECT * FROM teams`;
    res.json(result);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// get team by id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await prisma.$queryRaw<any[]>`SELECT * FROM teams WHERE id = ${parseInt(id)}`;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result[0]);
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Update a team
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    const result = await prisma.$queryRaw<any[]>`
      UPDATE teams SET name = ${name} WHERE id = ${parseInt(id)} RETURNING *
    `;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result[0]);
  } catch (err) {
    console.error('Error updating team:', err);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete a team
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await prisma.$queryRaw<any[]>`
      DELETE FROM teams WHERE id = ${parseInt(id)} RETURNING *
    `;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({ message: 'Team deleted successfully', team: result[0] });
  } catch (err) {
    console.error('Error deleting team:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router;