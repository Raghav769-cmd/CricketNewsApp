import express from 'express';
import matchesRouter from './routes/matches.ts';
import teamsRouter from './routes/teams.ts';
import playersRouter from './routes/players.ts';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use('/api/matches', matchesRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/players', playersRouter);

app.get('/', (req, res) => {
    res.send('Hello from the API!');
});

app.listen(PORT, () => {
    console.log(`API is running on http://localhost:${PORT}`);
});