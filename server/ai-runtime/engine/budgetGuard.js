export function validateExecutorBudgets(plan) {
  const budgets = plan?.budgets || {};
  const maxTasks = Number(budgets.maxTasks ?? 24);
  const maxParallelTasks = Number(budgets.maxParallelTasks ?? 4);
  const maxRepairCycles = Number(budgets.maxRepairCycles ?? 2);

  const errors = [];
  if (!Number.isFinite(maxTasks) || maxTasks < 1) {
    errors.push('Invalid maxTasks budget.');
  }
  if (!Number.isFinite(maxParallelTasks) || maxParallelTasks < 1) {
    errors.push('Invalid maxParallelTasks budget.');
  }
  if (!Number.isFinite(maxRepairCycles) || maxRepairCycles < 0) {
    errors.push('Invalid maxRepairCycles budget.');
  }

  if ((plan?.tasks || []).length > maxTasks) {
    errors.push(`Plan contains ${(plan?.tasks || []).length} tasks, exceeding maxTasks=${maxTasks}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    limits: {
      maxTasks,
      maxParallelTasks,
      maxRepairCycles,
    },
  };
}
