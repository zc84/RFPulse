import { randomUUID } from 'node:crypto';
import { visualError } from '../domain/errors.js';

export class MemoryProviderConcurrencyGate {
  constructor({ maxConcurrent = 2 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
  }

  async run(operation) {
    if (this.active >= this.maxConcurrent) {
      throw visualError(
        'PROVIDER_CAPACITY_EXCEEDED',
        'The visual image provider is at its concurrency limit.',
        503
      );
    }
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
    }
  }
}

export class PostgresProviderConcurrencyGate {
  constructor({
    query,
    maxConcurrent = Number(process.env.ENDPOINT_VISUAL_PROVIDER_MAX_CONCURRENT || 2),
    leaseTtlSeconds = Number(process.env.ENDPOINT_VISUAL_PROVIDER_LEASE_TTL_SECONDS || 330),
  }) {
    this.query = query;
    this.maxConcurrent = maxConcurrent;
    this.leaseTtlSeconds = leaseTtlSeconds;
  }

  async run(operation) {
    const leaseId = randomUUID();
    const claimed = await this.query(
      `SELECT claim_endpoint_visual_provider_lease($1, $2, $3) AS claimed`,
      [leaseId, this.maxConcurrent, this.leaseTtlSeconds]
    );
    if (!claimed.rows[0]?.claimed) {
      throw visualError(
        'PROVIDER_CAPACITY_EXCEEDED',
        'The visual image provider is at its global concurrency limit.',
        503
      );
    }
    try {
      return await operation();
    } finally {
      try {
        await this.query(
          `DELETE FROM endpoint_visual_provider_leases WHERE lease_id = $1`,
          [leaseId]
        );
      } catch (error) {
        console.error('Failed to release endpoint visual provider lease', {
          leaseId,
          message: error?.message || 'Unknown database error',
        });
      }
    }
  }
}
