import { visualError } from '../domain/errors.js';

export class MemoryVisualBudgetGate {
  constructor({ plannerLimit = 200, imageLimit = 50 } = {}) {
    this.plannerLimit = plannerLimit;
    this.imageLimit = imageLimit;
    this.plannerCalls = 0;
    this.imageCalls = 0;
  }

  async reserve({ plannerCalls = 0, imageCalls = 0 }) {
    if (
      this.plannerCalls + plannerCalls > this.plannerLimit
      || this.imageCalls + imageCalls > this.imageLimit
    ) {
      throw visualError('BUDGET_EXCEEDED', 'The public visual endpoint has reached its usage budget.', 429);
    }
    this.plannerCalls += plannerCalls;
    this.imageCalls += imageCalls;
  }
}

export class PostgresVisualBudgetGate {
  constructor({
    query,
    plannerLimit = Number(process.env.ENDPOINT_VISUAL_DAILY_PLANNER_LIMIT || 200),
    imageLimit = Number(process.env.ENDPOINT_VISUAL_DAILY_IMAGE_LIMIT || 50),
  }) {
    this.query = query;
    this.plannerLimit = plannerLimit;
    this.imageLimit = imageLimit;
  }

  async reserve({ plannerCalls = 0, imageCalls = 0 }) {
    if (
      plannerCalls < 0
      || imageCalls < 0
      || plannerCalls > this.plannerLimit
      || imageCalls > this.imageLimit
    ) {
      throw visualError('BUDGET_EXCEEDED', 'The requested visual work exceeds the configured budget.', 429);
    }
    const result = await this.query(
      `INSERT INTO endpoint_visual_daily_budget
        (usage_date, planner_calls, image_calls)
       VALUES (CURRENT_DATE, $1, $2)
       ON CONFLICT (usage_date) DO UPDATE
       SET planner_calls = endpoint_visual_daily_budget.planner_calls + EXCLUDED.planner_calls,
           image_calls = endpoint_visual_daily_budget.image_calls + EXCLUDED.image_calls,
           updated_at = NOW()
       WHERE endpoint_visual_daily_budget.planner_calls + EXCLUDED.planner_calls <= $3
         AND endpoint_visual_daily_budget.image_calls + EXCLUDED.image_calls <= $4
       RETURNING planner_calls, image_calls`,
      [plannerCalls, imageCalls, this.plannerLimit, this.imageLimit]
    );
    if (result.rowCount === 0) {
      throw visualError('BUDGET_EXCEEDED', 'The public visual endpoint has reached its daily usage budget.', 429);
    }
  }
}

