export class DiagramGenerationError extends Error {
  constructor(code, message, status = 502, details = undefined) {
    super(message);
    this.name = 'DiagramGenerationError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

export function diagramGenerationError(code, message, status = 502, details = undefined) {
  return new DiagramGenerationError(code, message, status, details);
}

export function isAbortError(error) {
  return Boolean(
    error?.name === 'AbortError'
      || error?.code === 'ABORT_ERR'
      || error?.code === 'AI_RUN_CANCELLED'
      || error?.code === 'REQUEST_TIMEOUT'
      || error?.code === 'CLIENT_DISCONNECTED'
      || error?.status === 499
  );
}
