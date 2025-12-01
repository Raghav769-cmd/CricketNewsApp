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

export default router;