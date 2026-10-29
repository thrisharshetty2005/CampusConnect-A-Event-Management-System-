export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export class StoreBusyError extends Error {}

export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
