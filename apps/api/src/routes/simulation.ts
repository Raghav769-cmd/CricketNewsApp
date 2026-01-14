import { Router } from 'express';
import { prisma } from '../db/connection.js';
import { getIO } from '../server.ts';
import { verifyToken, isAdmin } from '../middleware/auth.ts';
import { convertBigIntToString } from '../utils/bigintConverter.ts';

const router: Router = Router();

router.post('/:matchId/simulate', verifyToken, isAdmin, async (req, res) => {
  const { matchId } = req.params;

  try {
    if (!matchId) {
      return res.status(400).json({ error: 'Invalid match ID' });
    }
    const parsedMatchId = parseInt(matchId);
    if (isNaN(parsedMatchId)) {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    console.log(`Starting simulation for match ID: ${parsedMatchId}`);

    for (let over = 1; over <= 20; over++) {
      try {
        // Insert an over into the database
        const overResult = await prisma.$queryRaw<any[]>`
          INSERT INTO overs (match_id, over_number) VALUES (${parsedMatchId}, ${over}) RETURNING id
        `;
        const overId = overResult[0].id;

        for (let ball = 1; ball <= 6; ball++) {
          try {
            // Generate random runs and events
            const possibleRuns = [0, 1, 2, 4, 6];
            const runs = possibleRuns[Math.floor(Math.random() * possibleRuns.length)];
            const event = runs === 4 ? '4' : runs === 6 ? '6' : null;

            // Insert a ball into the database
            await prisma.$queryRaw`
              INSERT INTO balls (over_id, ball_number, runs, event) VALUES (${overId}, ${ball}, ${runs}, ${event})
            `;

            // Emit live update over socket.io if available
            try {
              const io = getIO();
              if (io) {
                const payload = convertBigIntToString({
                  matchId: String(parsedMatchId),
                  liveScore: `${runs} runs on over ${over} ball ${ball}`,
                });
                console.log('Emitting ballUpdate via socket.io:', payload);
                io.to(`match_${parsedMatchId}`).emit('ballUpdate', payload);
              }
            } catch (emitErr) {
              console.error('Error emitting socket update:', emitErr);
            }
          } catch (ballErr) {
            console.error(`Error inserting ball ${ball} of over ${over}:`, ballErr);
          }
        }
      } catch (overErr) {
        console.error(`Error processing over ${over}:`, overErr);
      }
    }

    res.status(200).json({ message: `Simulation complete for match ID: ${parsedMatchId}` });
  } catch (err) {
    console.error('Error during simulation:', err);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

export default router;