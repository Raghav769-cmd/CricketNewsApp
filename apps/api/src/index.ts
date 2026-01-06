import express from 'express';
import matchesRouter from './routes/matches.ts';
import teamsRouter from './routes/teams.ts';
import playersRouter from './routes/players.ts';
import authRouter from './routes/auth.ts';
import http from 'http';
import { setupSocket } from './server.ts';
import simulationRouter from './routes/simulation.ts';
import cors from 'cors';
import descriptionsRouter from './routes/playerDescriptions.ts';
import stadiumsRouter from './routes/stadiums.ts';

const app = express();
const server = http.createServer(app);
setupSocket(server);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
}));

app.use('/api/auth', authRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/players', playersRouter);
app.use('/api/stadiums', stadiumsRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api', descriptionsRouter);

app.get('/', (req, res) => {
    res.send('Hello from the API!');
});

// Start the HTTP server (so socket.io is attached to the same server)
server.listen(PORT, () => {
  console.log(`API is running on http://localhost:${PORT}`);
});