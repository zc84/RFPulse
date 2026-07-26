export class VisualApiError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'VisualApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

export function visualError(code, message, status = 400, details = undefined) {
  return new VisualApiError(code, message, status, details);
}

