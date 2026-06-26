import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import dealsRoutes from './routes/deals.js';
import usersRoutes from './routes/users.js';
import agentsRoutes from './routes/agents.js';
import aiRoutes from './routes/ai.js';
import platformRoutes from './routes/platform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai/agents', agentsRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/deals/:id/ai', aiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  const status = Number(err.status || err.statusCode) || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  let message = err.expose || safeStatus < 500
    ? err.message
    : 'Internal server error';

  if (err.code === '42P01') {
    message = 'Database schema is missing a required table. Run yarn db:setup and retry.';
  } else if (err.code === '42703') {
    message = 'Database schema is missing a required column. Run yarn db:setup and retry.';
  }

  res.status(safeStatus).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`RFPulse API running on http://localhost:${PORT}`);
});
