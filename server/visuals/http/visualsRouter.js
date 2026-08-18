import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { VisualApiError, visualError } from '../domain/errors.js';
import { formatPlanResponse } from '../application/formatPlanResponse.js';

function idempotencyKeyFrom(req) {
  const value = req.get('Idempotency-Key');
  if (!value) throw visualError('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required for render requests.', 400);
  if (!/^[\x21-\x7E]{8,128}$/.test(value)) {
    throw visualError('IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key must contain 8-128 visible ASCII characters.', 400);
  }
  return value;
}

function createDeadline(req, res, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(
    visualError('REQUEST_TIMEOUT', 'The visual request exceeded its execution deadline.', 504)
  ), timeoutMs);
  const abort = () => {
    if (!res.writableEnded) controller.abort(
      visualError('CLIENT_DISCONNECTED', 'The client disconnected before rendering completed.', 499)
    );
  };
  req.once('aborted', abort);
  res.once('close', abort);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      req.off('aborted', abort);
      res.off('close', abort);
    },
  };
}

function createConcurrencyGate(maxConcurrent) {
  let active = 0;
  return {
    async run(operation) {
      if (active >= maxConcurrent) {
        throw visualError('CAPACITY_EXCEEDED', 'The visual service is at its concurrency limit.', 503);
      }
      active += 1;
      try {
        return await operation();
      } finally {
        active -= 1;
      }
    },
  };
}

function limiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many visual requests. Please retry later.',
          request_id: req.requestId,
        },
      });
    },
  });
}

function sendVisualError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The visual request does not match the required schema.',
        request_id: req.requestId,
        details: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'SOURCE_TOO_LARGE',
        message: 'The visual request body exceeds the configured size limit.',
        request_id: req.requestId,
      },
    });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Malformed JSON request body.',
        request_id: req.requestId,
      },
    });
  }
  if (error instanceof VisualApiError || (error?.expose && error?.code)) {
    const status = Number(error.status) || 500;
    return res.status(status).json({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: status < 500 || error.expose ? error.message : 'Internal visual service error.',
        request_id: req.requestId,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }
  console.error('Unexpected visual endpoint error', error);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal visual service error.',
      request_id: req.requestId,
    },
  });
}

export function createVisualsRouter({
  visualModule,
  bodyLimit = process.env.ENDPOINT_VISUAL_BODY_LIMIT || '1mb',
  // High-quality image rendering can exceed one minute even after planning.
  // Keep a bounded deadline while allowing one proposal-grade image call to finish.
  timeoutMs = Number(process.env.ENDPOINT_VISUAL_TIMEOUT_MS || 300_000),
  planRateLimit = Number(process.env.ENDPOINT_VISUAL_PLAN_RATE_LIMIT || 20),
  renderRateLimit = Number(process.env.ENDPOINT_VISUAL_RENDER_RATE_LIMIT || 10),
  rateWindowMs = Number(process.env.ENDPOINT_VISUAL_RATE_WINDOW_MS || 15 * 60 * 1000),
  maxConcurrent = Number(process.env.ENDPOINT_VISUAL_MAX_CONCURRENT || 2),
  enabled = process.env.ENDPOINT_VISUALS_ENABLED !== 'false',
} = {}) {
  const router = Router();
  const jsonParser = express.json({ limit: bodyLimit });
  const gate = createConcurrencyGate(maxConcurrent);
  const planLimiter = limiter({ windowMs: rateWindowMs, max: planRateLimit });
  const renderLimiter = limiter({ windowMs: rateWindowMs, max: renderRateLimit });

  router.use((req, res, next) => {
    req.requestId = req.get('X-Request-Id')?.slice(0, 128) || randomUUID();
    res.set('X-Request-Id', req.requestId);
    if (!enabled) return sendVisualError(
      visualError('SERVICE_DISABLED', 'The public visual endpoint is currently disabled.', 503),
      req,
      res,
      next
    );
    next();
  });

  router.post('/plan', planLimiter, jsonParser, async (req, res, next) => {
    const deadline = createDeadline(req, res, timeoutMs);
    try {
      const result = await gate.run(() => visualModule.planVisuals(req.body, { signal: deadline.signal }));
      res.json(formatPlanResponse(result, { requestId: req.requestId, includePlan: true }));
    } catch (error) {
      if (!req.aborted && !res.destroyed) {
        sendVisualError(deadline.signal.aborted ? deadline.signal.reason : error, req, res, next);
      }
    } finally {
      deadline.dispose();
    }
  });

  router.post('/render', renderLimiter, jsonParser, async (req, res, next) => {
    const deadline = createDeadline(req, res, timeoutMs);
    try {
      const key = idempotencyKeyFrom(req);
      const result = await gate.run(() => visualModule.idempotencyStore.execute({
        route: '/v1/visuals/render',
        key,
        request: req.body,
        operation: () => visualModule.renderVisuals(req.body, {
          signal: deadline.signal,
          requestId: req.requestId,
        }),
      }));
      res.json(result);
    } catch (error) {
      if (!req.aborted && !res.destroyed) {
        sendVisualError(deadline.signal.aborted ? deadline.signal.reason : error, req, res, next);
      }
    } finally {
      deadline.dispose();
    }
  });

  router.use((error, req, res, next) => sendVisualError(error, req, res, next));
  return router;
}
