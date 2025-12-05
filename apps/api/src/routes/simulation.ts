import { Router } from 'express';
import pool from '../db/connection.js';
import { getIO } from '../server.ts';
import { verifyToken, isAdmin } from '../middleware/auth.ts';

const router: Router = Router();

router.post('/:matchId/simulate', verifyToken, isAdmin, async (req, res) => {
  const { matchId } = req.params;

  try {
    console.log(`Starting simulation for match ID: ${matchId}`);

    for (let over = 1; over <= 20; over++) {
      // Insert an over into the database
      const overResult = await pool.query(
        `INSERT INTO overs (match_id, over_number) VALUES ($1, $2) RETURNING id`,
        [matchId, over]
      );
      const overId = overResult.rows[0].id;

      for (let ball = 1; ball <= 6; ball++) {
        // Generate random runs and events
        const possibleRuns = [0, 1, 2, 4, 6];
        const runs = possibleRuns[Math.floor(Math.random() * possibleRuns.length)];
        const event = runs === 4 ? '4' : runs === 6 ? '6' : null;

        // Insert a ball into the database
        await pool.query(
          `INSERT INTO balls (over_id, ball_number, runs, event) VALUES ($1, $2, $3, $4)`,
          [overId, ball, runs, event]
        );

        // Emit live update over socket.io if available
        try {
          const io = getIO();
          if (io) {
            const payload = {
              matchId: String(matchId),
              liveScore: `${runs} runs on over ${over} ball ${ball}`,
            };
            console.log('Emitting ballUpdate via socket.io:', payload);
            io.to(`match_${matchId}`).emit('ballUpdate', payload);
          }
        } catch (emitErr) {
          console.error('Error emitting socket update:', emitErr);
        }
      }
    }

    res.status(200).send(`Simulation complete for match ID: ${matchId}`);
  } catch (err) {
    console.error('Error during simulation:', err);
    res.status(500).send('Simulation failed');
  }
});

export default router;