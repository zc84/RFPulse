import { createHash, randomUUID } from 'node:crypto';
import { canonicalJson } from '../domain/facts.js';
import { visualError } from '../domain/errors.js';

const DEFAULT_TTL_MS = 30 * 60 * 1000;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function requestDigest(value) {
  return digest(canonicalJson(value));
}

export class MemoryIdempotencyStore {
  constructor({ clock = () => new Date(), ttlMs = DEFAULT_TTL_MS } = {}) {
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.records = new Map();
  }

  async execute({ route, key, request, operation }) {
    const keyHash = digest(`${route}:${key}`);
    const payloadDigest = requestDigest(request);
    const current = this.records.get(keyHash);
    if (current && current.expiresAt > this.clock()) {
      if (current.requestDigest !== payloadDigest) {
        throw visualError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for a different request.', 409);
      }
      if (current.status === 'in_progress') {
        throw visualError('IDEMPOTENCY_IN_PROGRESS', 'The original request is still in progress.', 409);
      }
      if (current.status === 'complete') return structuredClone(current.response);
    }

    const record = {
      requestDigest: payloadDigest,
      status: 'in_progress',
      expiresAt: new Date(this.clock().getTime() + this.ttlMs),
    };
    this.records.set(keyHash, record);
    try {
      const response = await operation();
      record.status = 'complete';
      record.response = structuredClone(response);
      return response;
    } catch (error) {
      this.records.delete(keyHash);
      throw error;
    }
  }
}

export class PostgresIdempotencyStore {
  constructor({
    query,
    ttlMs = DEFAULT_TTL_MS,
    maxResponseBytes = Number(
      process.env.ENDPOINT_VISUAL_MAX_IDEMPOTENCY_RESPONSE_BYTES || 12 * 1024 * 1024
    ),
  }) {
    this.query = query;
    this.ttlMs = ttlMs;
    this.maxResponseBytes = maxResponseBytes;
  }

  async execute({ route, key, request, operation }) {
    const keyHash = digest(`${route}:${key}`);
    const payloadDigest = requestDigest(request);
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const claimToken = randomUUID();
    await this.query(
      `DELETE FROM endpoint_visual_idempotency WHERE expires_at <= NOW()`
    );
    const claimed = await this.query(
      `INSERT INTO endpoint_visual_idempotency
        (route, key_hash, request_digest, claim_token, status, expires_at)
       VALUES ($1, $2, $3, $4, 'in_progress', $5)
       ON CONFLICT (route, key_hash) DO NOTHING
       RETURNING key_hash`,
      [route, keyHash, payloadDigest, claimToken, expiresAt]
    );

    if (claimed.rowCount === 0) {
      const existing = await this.query(
        `SELECT request_digest, status, response
         FROM endpoint_visual_idempotency
         WHERE route = $1 AND key_hash = $2 AND expires_at > NOW()`,
        [route, keyHash]
      );
      const row = existing.rows[0];
      if (!row) {
        throw visualError('IDEMPOTENCY_STATE_AMBIGUOUS', 'The previous request state is ambiguous; use a new idempotency key.', 409);
      }
      if (row.request_digest !== payloadDigest) {
        throw visualError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for a different request.', 409);
      }
      if (row.status === 'complete') return row.response;
      if (row.status === 'failed') {
        throw visualError(
          'IDEMPOTENCY_PREVIOUSLY_FAILED',
          'The previous request failed after work began; use a new idempotency key to retry explicitly.',
          409
        );
      }
      throw visualError('IDEMPOTENCY_IN_PROGRESS', 'The original request is still in progress.', 409);
    }

    try {
      const response = await operation();
      const serialized = JSON.stringify(response);
      if (Buffer.byteLength(serialized, 'utf8') > this.maxResponseBytes) {
        throw visualError(
          'IDEMPOTENCY_RESPONSE_TOO_LARGE',
          'The rendered response is too large for safe idempotent persistence.',
          500
        );
      }
      await this.query(
        `UPDATE endpoint_visual_idempotency
         SET status = 'complete', response = $3::jsonb, completed_at = NOW()
         WHERE route = $1 AND key_hash = $2 AND claim_token = $4`,
        [route, keyHash, serialized, claimToken]
      );
      return response;
    } catch (error) {
      await this.query(
        `UPDATE endpoint_visual_idempotency
         SET status = 'failed', completed_at = NOW()
         WHERE route = $1 AND key_hash = $2 AND claim_token = $3`,
        [route, keyHash, claimToken]
      );
      throw error;
    }
  }
}
