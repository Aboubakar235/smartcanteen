/** Évite les try/catch répétés dans chaque contrôleur Express. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Erreur métier avec code HTTP explicite, pour un message clair côté client (ENF-21). */
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
