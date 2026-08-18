import { visualError } from '../domain/errors.js';

export class MemoryVisualBudgetGate {
  constructor({
    plannerLimit = 200,
    imageLimit = 50,
    qaLimit = 100,
    regenerationLimit = 50,
    costLimit = 1_000,
  } = {}) {
    this.plannerLimit = plannerLimit;
    this.imageLimit = imageLimit;
    this.qaLimit = qaLimit;
    this.regenerationLimit = regenerationLimit;
    this.costLimit = costLimit;
    this.plannerCalls = 0;
    this.imageCalls = 0;
    this.qaCalls = 0;
    this.regenerationCalls = 0;
    this.costUnits = 0;
  }

  async reserve({
    plannerCalls = 0,
    imageCalls = 0,
    qaCalls = 0,
    regenerationCalls = 0,
    costUnits = plannerCalls + imageCalls * 10 + qaCalls * 2 + regenerationCalls * 10,
  }) {
    if (
      this.plannerCalls + plannerCalls > this.plannerLimit
      || this.imageCalls + imageCalls > this.imageLimit
      || this.qaCalls + qaCalls > this.qaLimit
      || this.regenerationCalls + regenerationCalls > this.regenerationLimit
      || this.costUnits + costUnits > this.costLimit
    ) {
      throw visualError('BUDGET_EXCEEDED', 'The public visual endpoint has reached its usage budget.', 429);
    }
    this.plannerCalls += plannerCalls;
    this.imageCalls += imageCalls;
    this.qaCalls += qaCalls;
    this.regenerationCalls += regenerationCalls;
    this.costUnits += costUnits;
  }
}

export class PostgresVisualBudgetGate {
  constructor({
    query,
    hourlyPlannerLimit = Number(process.env.ENDPOINT_VISUAL_HOURLY_PLANNER_LIMIT || 40),
    hourlyImageLimit = Number(process.env.ENDPOINT_VISUAL_HOURLY_IMAGE_LIMIT || 10),
    hourlyQaLimit = Number(process.env.ENDPOINT_VISUAL_HOURLY_QA_LIMIT || 20),
    hourlyRegenerationLimit = Number(process.env.ENDPOINT_VISUAL_HOURLY_REGENERATION_LIMIT || 10),
    hourlyCostLimit = Number(process.env.ENDPOINT_VISUAL_HOURLY_COST_UNITS || 200),
    dailyPlannerLimit = Number(process.env.ENDPOINT_VISUAL_DAILY_PLANNER_LIMIT || 200),
    dailyImageLimit = Number(process.env.ENDPOINT_VISUAL_DAILY_IMAGE_LIMIT || 50),
    dailyQaLimit = Number(process.env.ENDPOINT_VISUAL_DAILY_QA_LIMIT || 100),
    dailyRegenerationLimit = Number(process.env.ENDPOINT_VISUAL_DAILY_REGENERATION_LIMIT || 50),
    dailyCostLimit = Number(process.env.ENDPOINT_VISUAL_DAILY_COST_UNITS || 1_000),
  }) {
    this.query = query;
    this.limits = {
      hourlyPlannerLimit,
      hourlyImageLimit,
      hourlyQaLimit,
      hourlyRegenerationLimit,
      hourlyCostLimit,
      dailyPlannerLimit,
      dailyImageLimit,
      dailyQaLimit,
      dailyRegenerationLimit,
      dailyCostLimit,
    };
  }

  async reserve({
    plannerCalls = 0,
    imageCalls = 0,
    qaCalls = 0,
    regenerationCalls = 0,
    costUnits = plannerCalls + imageCalls * 10 + qaCalls * 2 + regenerationCalls * 10,
  }) {
    if (
      plannerCalls < 0
      || imageCalls < 0
      || qaCalls < 0
      || regenerationCalls < 0
      || costUnits < 0
    ) {
      throw visualError('BUDGET_EXCEEDED', 'The requested visual work exceeds the configured budget.', 429);
    }
    const limits = this.limits;
    const result = await this.query(
      `SELECT reserve_endpoint_visual_budget(
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15
       ) AS reserved`,
      [
        plannerCalls,
        imageCalls,
        qaCalls,
        regenerationCalls,
        costUnits,
        limits.hourlyPlannerLimit,
        limits.hourlyImageLimit,
        limits.hourlyQaLimit,
        limits.hourlyRegenerationLimit,
        limits.hourlyCostLimit,
        limits.dailyPlannerLimit,
        limits.dailyImageLimit,
        limits.dailyQaLimit,
        limits.dailyRegenerationLimit,
        limits.dailyCostLimit,
      ]
    );
    if (!result.rows[0]?.reserved) {
      throw visualError(
        'BUDGET_EXCEEDED',
        'The public visual endpoint has reached its hourly or daily usage budget.',
        429
      );
    }
  }
}
