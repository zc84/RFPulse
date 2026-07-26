import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import dealsRoutes from './routes/deals.js';
import usersRoutes from './routes/users.js';
import agentsRoutes from './routes/agents.js';
import aiRoutes from './routes/ai.js';
import platformRoutes from './routes/platform.js';
import diagramsRoutes from './routes/diagrams.js';
import { createVisualsRouter } from './visuals/http/visualsRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');

export function createApp({ visualModule = null, visualRouterOptions = {} } = {}) {
  const app = express();

  // Configure this hop count per deployment so IP-based public endpoint limits
  // cannot be bypassed through incorrectly trusted proxy headers.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
  app.use(helmet({ contentSecurityPolicy: false }));

  const corsAllowlist = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  if (corsAllowlist.length > 0) {
    app.use(cors({
      origin(origin, callback) {
        if (!origin || corsAllowlist.includes(origin)) return callback(null, true);
        callback(new Error('Origin not allowed by CORS'));
      },
    }));
  } else if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
  }

  // The public visual API owns its parser and error envelope. Mount it before
  // the legacy parser so malformed/oversized bodies keep visual-specific codes.
  if (visualModule) {
    app.use('/v1/visuals', createVisualsRouter({ visualModule, ...visualRouterOptions }));
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
      if (req.path.startsWith('/api') || req.path.startsWith('/v1')) return next();
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

  return app;
}
