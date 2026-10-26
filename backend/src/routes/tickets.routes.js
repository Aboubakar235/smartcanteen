import { Router } from "express";
import { z } from "zod";
import { withTransaction } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { verifierJetonQr } from "../services/ticket.service.js";

const router = Router();

// UC-10 — Vérifier un ticket (EF-29 à EF-32)
// Accepte soit le jeton scanné (`token`), soit une saisie manuelle du
// numéro de passage (EF-31, si le scan échoue).
const scanSchema = z
  .object({
    token: z.string().optional(),
    numeroPassage: z.string().optional(),
  })
  .refine((d) => d.token || d.numeroPassage, "Fournir un jeton scanné ou un numéro de passage.");

router.post(
  "/scan",
  requireAuth,
  requireRole("AGENT_CONTROLE"),
  asyncHandler(async (req, res) => {
    const data = scanSchema.parse(req.body);

    const resultat = await withTransaction(async (client) => {
      let ticket;

      if (data.token) {
        const payload = verifierJetonQr(data.token);
        if (!payload) return logEtRepondre(client, null, req.user.id, "invalide", "QR Code invalide ou expiré.");

        const { rows } = await client.query(
          "SELECT * FROM tickets WHERE reservation_id = $1 FOR UPDATE",
          [payload.reservationId]
        );
        ticket = rows[0];
      } else {
        const { rows } = await client.query(
          `SELECT t.* FROM tickets t
           JOIN reservations r ON r.id = t.reservation_id
           WHERE r.numero_passage = $1
           ORDER BY t.date_generation DESC LIMIT 1 FOR UPDATE`,
          [data.numeroPassage]
        );
        ticket = rows[0];
      }

      if (!ticket) {
        return logEtRepondre(client, null, req.user.id, "inexistant", "Ticket introuvable.");
      }

      const { rows: resRows } = await client.query(
        "SELECT * FROM reservations WHERE id = $1",
        [ticket.reservation_id]
      );
      const reservation = resRows[0];

      if (ticket.utilise) {
        return logEtRepondre(client, ticket.id, req.user.id, "deja_utilise", "Ticket déjà utilisé.");
      }
      if (["ANNULEE", "ABSENTE"].includes(reservation.etat)) {
        return logEtRepondre(client, ticket.id, req.user.id, "annule", "Réservation annulée.");
      }
      const maintenant = new Date();
      if (maintenant < new Date(ticket.validite_debut)) {
        return logEtRepondre(
          client,
          ticket.id,
          req.user.id,
          "invalide",
          "Trop tôt : ce ticket n'est pas encore dans sa plage de validité.",
          { validiteDebut: ticket.validite_debut }
        );
      }
      if (maintenant > new Date(ticket.validite_fin)) {
        return logEtRepondre(client, ticket.id, req.user.id, "expire", "Ticket expiré (plage de validité dépassée).");
      }

      // EF-30 : marquer le ticket comme utilisé dès la première validation.
      await client.query(
        "UPDATE tickets SET utilise = TRUE, date_utilisation = now() WHERE id = $1",
        [ticket.id]
      );
      await client.query(
        "UPDATE reservations SET etat = 'ENTREE' WHERE id = $1",
        [reservation.id]
      );
      await client.query(
        "INSERT INTO historique_etats (reservation_id, etat, auteur) VALUES ($1, 'ENTREE', 'agent')",
        [reservation.id]
      );
      // EF-32 : enregistrer l'heure d'entrée pour calculer le rythme réel de passage.
      return logEtRepondre(client, ticket.id, req.user.id, "valide", "Accès validé.", {
        numeroPassage: reservation.numero_passage,
        mode: reservation.mode,
      });
    });

    res.json(resultat);
  })
);

async function logEtRepondre(client, ticketId, agentId, verdict, message, extra = {}) {
  await client.query(
    "INSERT INTO scan_logs (ticket_id, agent_id, verdict) VALUES ($1, $2, $3)",
    [ticketId, agentId, verdict]
  );
  return { verdict, message, ...extra };
}

export default router;
