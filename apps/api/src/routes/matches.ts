import { Router } from 'express';
import pool from '../db/connection.js';

const router: Router = Router();

// get all matches
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM matches');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// get match by id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM matches WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Match not found');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Add match
router.post('/', async (req, res) => {
  const { team1, team2, date, venue, score } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO matches (team1, team2, date, venue, score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [team1, team2, date, venue, score]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Update a match
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { team1, team2, date, venue, score } = req.body;
  try {
    const result = await pool.query(
      'UPDATE matches SET team1 = $1, team2 = $2, date = $3, venue = $4, score = $5 WHERE id = $6 RETURNING *',
      [team1, team2, date, venue, score, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Match not found');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Delete a match
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM matches WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Match not found');
    }
    res.json({ message: 'Match deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

export default router;