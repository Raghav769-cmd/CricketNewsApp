import { Router } from 'express';
import { prisma } from '../db/connection.js';

const router: Router = Router();

// get all teams
router.get('/', async (req, res) => {
  try {
    const result = await prisma.teams.findMany();
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
    const result = await prisma.teams.findUnique({
      where: { id: parseInt(id) },
    });
    if (!result) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json(result);
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
    try {
      const result = await prisma.teams.update({
        where: { id: parseInt(id) },
        data: { name },
      });
      res.json(result);
    } catch (err: any) {
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Team not found' });
      }
      throw err;
    }
  } catch (err) {
    console.error('Error updating team:', err);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete a team
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    try {
      const result = await prisma.teams.delete({
        where: { id: parseInt(id) },
      });
      res.json({ message: 'Team deleted successfully', team: result });
    } catch (err: any) {
      if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Team not found' });
      }
      throw err;
    }
  } catch (err) {
    console.error('Error deleting team:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router;