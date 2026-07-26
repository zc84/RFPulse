import { query } from '../db.js';
import { createPlanVisualsUseCase } from './application/planVisuals.js';
import { createRenderVisualsUseCase } from './application/renderVisuals.js';
import { createOpenAiOverviewRenderer } from './infrastructure/openAiOverviewRenderer.js';
import { createOpenAiVisualProvider } from './infrastructure/openAiVisualProvider.js';
import { PostgresIdempotencyStore } from './infrastructure/idempotencyStores.js';
import { PostgresVisualPlanStore } from './infrastructure/planStores.js';
import { PostgresVisualBudgetGate } from './infrastructure/budgetGates.js';

export async function createProductionVisualModule() {
  const provider = await createOpenAiVisualProvider();
  const planStore = new PostgresVisualPlanStore({ query });
  const idempotencyStore = new PostgresIdempotencyStore({ query });
  const budgetGate = new PostgresVisualBudgetGate({ query });
  const planVisuals = createPlanVisualsUseCase({ provider, planStore, budgetGate });
  const overviewRenderer = createOpenAiOverviewRenderer(provider);
  const renderVisuals = createRenderVisualsUseCase({
    planVisuals,
    planStore,
    overviewRenderer,
    budgetGate,
  });
  return {
    planVisuals,
    renderVisuals,
    planStore,
    idempotencyStore,
  };
}
