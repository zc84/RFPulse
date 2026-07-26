import { createHash, randomBytes } from 'node:crypto';
import { visualError } from '../domain/errors.js';

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_RENDERS = 3;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return randomBytes(32).toString('base64url');
}

export class MemoryVisualPlanStore {
  constructor({ clock = () => new Date(), ttlMs = DEFAULT_TTL_MS, maxRenders = DEFAULT_MAX_RENDERS } = {}) {
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.maxRenders = maxRenders;
    this.records = new Map();
  }

  async issue({ plan, sourceDigest, versions }) {
    const token = createToken();
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    this.records.set(hashToken(token), {
      plan: structuredClone(plan),
      sourceDigest,
      versions: structuredClone(versions),
      createdAt: now,
      expiresAt,
      renderCount: 0,
    });
    return { token, expiresAt };
  }

  async consume(token) {
    const key = hashToken(token);
    const record = this.records.get(key);
    const now = this.clock();
    if (!record) throw visualError('PLAN_TOKEN_INVALID', 'The plan token is invalid.', 404);
    if (record.expiresAt <= now) {
      this.records.delete(key);
      throw visualError('PLAN_TOKEN_EXPIRED', 'The plan token has expired.', 410);
    }
    if (record.renderCount >= this.maxRenders) {
      throw visualError('PLAN_RENDER_LIMIT_REACHED', 'The plan token render limit has been reached.', 409);
    }
    record.renderCount += 1;
    return structuredClone(record);
  }
}

export class PostgresVisualPlanStore {
  constructor({ query, clock = () => new Date(), ttlMs = DEFAULT_TTL_MS, maxRenders = DEFAULT_MAX_RENDERS }) {
    this.query = query;
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.maxRenders = maxRenders;
  }

  async issue({ plan, sourceDigest, versions }) {
    const token = createToken();
    const tokenHash = hashToken(token);
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    await this.query('DELETE FROM endpoint_visual_plans WHERE expires_at <= NOW()');
    await this.query(
      `INSERT INTO endpoint_visual_plans
        (token_hash, plan, source_digest, versions, expires_at, max_renders)
       VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $6)`,
      [tokenHash, JSON.stringify(plan), sourceDigest, JSON.stringify(versions), expiresAt, this.maxRenders]
    );
    return { token, expiresAt };
  }

  async consume(token) {
    const tokenHash = hashToken(token);
    const result = await this.query(
      `UPDATE endpoint_visual_plans
       SET render_count = render_count + 1
       WHERE token_hash = $1
         AND expires_at > NOW()
         AND revoked_at IS NULL
         AND render_count < max_renders
       RETURNING plan, source_digest, versions, created_at, expires_at, render_count`,
      [tokenHash]
    );
    if (result.rows[0]) {
      const row = result.rows[0];
      return {
        plan: row.plan,
        sourceDigest: row.source_digest,
        versions: row.versions,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        renderCount: row.render_count,
      };
    }

    const state = await this.query(
      'SELECT expires_at, revoked_at, render_count, max_renders FROM endpoint_visual_plans WHERE token_hash = $1',
      [tokenHash]
    );
    const row = state.rows[0];
    if (!row) throw visualError('PLAN_TOKEN_INVALID', 'The plan token is invalid.', 404);
    if (row.revoked_at) throw visualError('PLAN_TOKEN_REVOKED', 'The plan token has been revoked.', 410);
    if (new Date(row.expires_at) <= this.clock()) throw visualError('PLAN_TOKEN_EXPIRED', 'The plan token has expired.', 410);
    throw visualError('PLAN_RENDER_LIMIT_REACHED', 'The plan token render limit has been reached.', 409);
  }
}

export { hashToken as hashVisualPlanToken };
