import pool from '../db/connection.js';

const simulateMatch = async (matchId: number) => {
  console.log(`Starting simulation for match ID: ${matchId}`);

  try {
    for (let over = 1; over <= 20; over++) {
      // Insert an over into the database
      const overResult = await pool.query(
        `INSERT INTO overs (match_id, over_number) VALUES ($1, $2) RETURNING id`,
        [matchId, over]
      );
      const overId = overResult.rows[0].id;

      for (let ball = 1; ball <= 6; ball++) {
        // Generate random runs (0, 1, 2, 4, 6)
        const possibleRuns = [0, 1, 2, 4, 6];
        const runs = possibleRuns[Math.floor(Math.random() * possibleRuns.length)];
        const event = runs === 4 ? '4' : runs === 6 ? '6' : null;

        // Insert a ball into the database
        await pool.query(
          `INSERT INTO balls (over_id, ball_number, runs, event) VALUES ($1, $2, $3, $4)`,
          [overId, ball, runs, event]
        );

        console.log(`Over ${over}, Ball ${ball}: ${runs} runs ${event ? `(${event})` : ''}`);
      }
    }

    console.log(`Simulation complete for match ID: ${matchId}`);
  } catch (err) {
    console.error('Error during simulation:', err);
  }
};

// Run the simulation for a specific match ID
simulateMatch(1).catch((err) => console.error(err));