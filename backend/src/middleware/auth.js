import jwt from "jsonwebtoken";
import { AppError } from "../lib/asyncHandler.js";

/**
 * Vérifie le JWT de session (EF-01) et attache req.user = { id, role, nom }.
 * Jetons de session courts, conformes à TECH-07.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new AppError(401, "Authentification requise."));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    next(new AppError(401, "Session invalide ou expirée, merci de vous reconnecter."));
  }
}

/**
 * Contrôle d'accès par rôle (EF-02, ENF-38) : les fonctions réservées au
 * personnel ne doivent pas être accessibles aux étudiants, et inversement.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, "Authentification requise."));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Vous n'avez pas accès à cette fonctionnalité."));
    }
    next();
  };
}
