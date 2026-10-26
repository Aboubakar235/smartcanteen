import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  creerReservation,
  annulerReservation,
  positionDansLaFile,
} from "../services/reservations.service.js";

const router = Router();

// UC-04 — Réserver un passage (EF-12 à EF-15)
const reservationSchema = z.object({
  creneauId: z.string().uuid(),
  repasId: z.string().uuid(),
  mode: z.enum(["SUR_PLACE", "A_EMPORTER"]),
});

router.post(
  "/",
  requireAuth,
  requireRole("ETUDIANT"),
  asyncHandler(async (req, res) => {
    const data = reservationSchema.parse(req.body);
    try {
      const { reservation, ticket } = await creerReservation({
        etudiantId: req.user.id,
        ...data,
      });
      res.status(201).json(toReservation(reservation, ticket));
    } catch (err) {
      if (err.alternatives) {
        err.details = { ...err.details, alternatives: err.alternatives };
      }
      throw err;
    }
  })
);

// UC-09 — Consulter l'historique des réservations (EF-36)
router.get(
  "/mes-reservations",
  requireAuth,
  requireRole("ETUDIANT"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT res.*, c.date, c.heure_debut, c.heure_fin, r.nom AS repas_nom, t.qr_code_jeton
       FROM reservations res
       JOIN creneaux c ON c.id = res.creneau_id
       JOIN repas r ON r.id = res.repas_id
       LEFT JOIN tickets t ON t.reservation_id = res.id
       WHERE res.etudiant_id = $1
       ORDER BY res.date_creation DESC`,
      [req.user.id]
    );
    res.json(rows.map(toHistorique));
  })
);

// UC-05 — Consulter le ticket et le QR Code (EF-18 à EF-20)
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT res.*, c.date, c.heure_debut, c.heure_fin, r.nom AS repas_nom, t.*
       FROM reservations res
       JOIN creneaux c ON c.id = res.creneau_id
       JOIN repas r ON r.id = res.repas_id
       LEFT JOIN tickets t ON t.reservation_id = res.id
       WHERE res.id = $1`,
      [req.params.id]
    );
    const row = rows[0];
    if (!row) throw new AppError(404, "Réservation introuvable.");
    // ENF-37 : un étudiant ne peut consulter que ses propres données.
    if (req.user.role === "ETUDIANT" && row.etudiant_id !== req.user.id) {
      throw new AppError(403, "Accès refusé.");
    }
    res.json(toHistorique(row));
  })
);

// UC-06 — Suivre la file et l'attente (EF-21, EF-22)
router.get(
  "/:id/file",
  requireAuth,
  asyncHandler(async (req, res) => {
    const infos = await positionDansLaFile(req.params.id);
    res.json(infos);
  })
);

// UC-08 — Annuler une réservation (EF-17)
router.post(
  "/:id/annuler",
  requireAuth,
  requireRole("ETUDIANT"),
  asyncHandler(async (req, res) => {
    const result = await annulerReservation(req.params.id, req.user.id);
    res.json(result);
  })
);

function toReservation(reservation, ticket) {
  return {
    id: reservation.id,
    numeroPassage: reservation.numero_passage,
    mode: reservation.mode,
    etat: reservation.etat,
    ticket: ticket
      ? {
          qrCodeJeton: ticket.qr_code_jeton,
          validiteDebut: ticket.validite_debut,
          validiteFin: ticket.validite_fin,
        }
      : null,
  };
}

function toHistorique(row) {
  return {
    id: row.id,
    numeroPassage: row.numero_passage,
    mode: row.mode,
    etat: row.etat,
    date: row.date,
    heureDebut: row.heure_debut,
    heureFin: row.heure_fin,
    repasNom: row.repas_nom,
    qrCodeJeton: row.qr_code_jeton ?? null,
  };
}

export default router;
