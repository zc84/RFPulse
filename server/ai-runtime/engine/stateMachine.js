export const TASK_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  WAITING_HUMAN: 'waiting_human',
};

export function isTerminalTaskStatus(status) {
  return status === TASK_STATUSES.COMPLETED
    || status === TASK_STATUSES.FAILED
    || status === TASK_STATUSES.CANCELLED;
}
