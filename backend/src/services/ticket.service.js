import jwt from "jsonwebtoken";
import { getParametres } from "../lib/params.js";

/**
 * EF-19, TECH-06 : le QR Code contient un jeton signé (ici JWT/HMAC-SHA256),
 * non falsifiable, sans donnée personnelle en clair — seul l'identifiant de
 * réservation et une expiration y figurent.
 */
export function genererJetonQr(reservationId, validiteFin) {
  return jwt.sign(
    { reservationId },
    process.env.JWT_SECRET,
    { expiresIn: Math.max(1, Math.floor((validiteFin.getTime() - Date.now()) / 1000)) }
  );
}

export function verifierJetonQr(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/** Fenêtre de validité du ticket : 10 min avant le créneau à 15 min après sa fin (§6.1). */
export async function fenetreValiditeTicket(heureDebutCreneau, heureFinCreneau) {
  const params = await getParametres();
  const debut = new Date(heureDebutCreneau.getTime() - params.validite_ticket_avant_min * 60_000);
  const fin = new Date(heureFinCreneau.getTime() + params.validite_ticket_apres_min * 60_000);
  return { debut, fin };
}
