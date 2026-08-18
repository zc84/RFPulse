import { query } from '../db.js';
import { createArchitectureImageRenderer } from '../diagram-generation/architectureRenderer.js';
import { createPlanVisualsUseCase } from './application/planVisuals.js';
import { createRenderVisualsUseCase } from './application/renderVisuals.js';
import { createOpenAiVisualProvider } from './infrastructure/openAiVisualProvider.js';
import { PostgresIdempotencyStore } from './infrastructure/idempotencyStores.js';
import { PostgresVisualPlanStore } from './infrastructure/planStores.js';
import { PostgresVisualBudgetGate } from './infrastructure/budgetGates.js';
import {
  PostgresProviderConcurrencyGate,
} from './infrastructure/providerConcurrencyGates.js';

export async function createProductionVisualModule() {
  const provider = await createOpenAiVisualProvider();
  const planStore = new PostgresVisualPlanStore({ query });
  const idempotencyStore = new PostgresIdempotencyStore({ query });
  const budgetGate = new PostgresVisualBudgetGate({ query });
  const providerConcurrencyGate = new PostgresProviderConcurrencyGate({ query });
  const gatedProvider = {
    completeStructured: options => providerConcurrencyGate.run(
      () => provider.completeStructured(options)
    ),
    generateImage: options => providerConcurrencyGate.run(
      () => provider.generateImage(options)
    ),
  };
  const planVisuals = createPlanVisualsUseCase({
    provider: gatedProvider,
    planStore,
    budgetGate,
  });
  const architectureRenderer = createArchitectureImageRenderer({
    generateImage: options => gatedProvider.generateImage(options),
  });
  const renderVisuals = createRenderVisualsUseCase({
    planVisuals,
    planStore,
    architectureRenderer,
    budgetGate,
  });
  return {
    planVisuals,
    renderVisuals,
    planStore,
    idempotencyStore,
  };
}
