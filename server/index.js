import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import dealsRoutes from './routes/deals.js';
import usersRoutes from './routes/users.js';
import agentsRoutes from './routes/agents.js';
import aiRoutes from './routes/ai.js';
import platformRoutes from './routes/platform.js';
import diagramsRoutes from './routes/diagrams.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind Render's proxy — needed so express-rate-limit sees the real client IP.
app.set('trust proxy', 1);

// Security headers. CSP is disabled because the SPA relies on inline styles and a
// Google Fonts CDN; the rest of helmet's defaults (nosniff, frameguard, etc.) still apply.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: same-origin in production (API and SPA share an origin), so an allowlist is only
// needed when the frontend is served from a different origin (local dev, split deploys).
const corsAllowlist = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
if (corsAllowlist.length > 0) {
  app.use(cors({
    origin(origin, cb) {
      if (!origin || corsAllowlist.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed by CORS'));
    },
  }));
} else if (process.env.NODE_ENV !== 'production') {
  // Dev convenience: Vite runs on a different port and talks to the API directly.
  app.use(cors());
}

app.use(express.json({ limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai/agents', agentsRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/deals/:id/ai', aiRoutes);
app.use('/v1/diagrams', diagramsRoutes);

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
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_request', detail: 'Malformed JSON request body' });
  }
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

const server = app.listen(PORT, () => {
  console.log(`RFPulse API running on http://localhost:${PORT}`);
});

server.on('error', err => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      [
        `RFPulse API could not start because port ${PORT} is already in use.`,
        `Stop the existing process on port ${PORT} and retry.`,
        `Hint: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
      ].join('\n')
    );
    process.exit(1);
  }

  console.error(err);
  process.exit(1);
});
