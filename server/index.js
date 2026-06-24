import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import dealsRoutes from './routes/deals.js';
import usersRoutes from './routes/users.js';
import agentsRoutes from './routes/agents.js';
import aiRoutes from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai/agents', agentsRoutes);
app.use('/api/deals/:id/ai', aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`RFPulse API running on http://localhost:${PORT}`);
});
