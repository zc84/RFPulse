export function getMaxAttemptsForTask(task, capability) {
  const taskMaxAttempts = Number(task?.retryPolicy?.maxAttempts);
  if (Number.isFinite(taskMaxAttempts) && taskMaxAttempts > 0) {
    return Math.floor(taskMaxAttempts);
  }

  const capabilityMaxAttempts = Number(capability?.retryPolicy?.maxAttempts);
  if (Number.isFinite(capabilityMaxAttempts) && capabilityMaxAttempts > 0) {
    return Math.floor(capabilityMaxAttempts);
  }

  return 1;
}

export function shouldRetryTask({ attempt, maxAttempts, error }) {
  if (attempt >= maxAttempts) return false;
  if (!error) return true;

  if (error?.isCancellation || error?.code === 'AI_RUN_CANCELLED' || error?.name === 'AbortError') {
    return false;
  }

  return true;
}
