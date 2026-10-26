import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getParametres } from "../lib/params.js";

const router = Router();

// UC-15 — Créer un créneau (EF-37, Administrateur)
const creneauSchema = z.object({
  date: z.string().date(),
  heureDebut: z.string().datetime(),
  heureFin: z.string().datetime(),
  capaciteMax: z.number().int().positive().optional(),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const data = creneauSchema.parse(req.body);
    const params = await getParametres();
    const capacite = data.capaciteMax ?? params.capacite_creneau_defaut ?? 60;

    const { rows } = await query(
      `INSERT INTO creneaux (date, heure_debut, heure_fin, capacite_max, capacite_restante, gere_par_id)
       VALUES ($1, $2, $3, $4, $4, $5) RETURNING *`,
      [data.date, data.heureDebut, data.heureFin, capacite, req.user.id]
    );
    res.status(201).json(toCreneau(rows[0]));
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const data = creneauSchema.partial().parse(req.body);
    const { rows } = await query("SELECT * FROM creneaux WHERE id = $1", [req.params.id]);
    if (!rows[0]) throw new AppError(404, "Créneau introuvable.");
    const current = rows[0];

    const capaciteMax = data.capaciteMax ?? current.capacite_max;
    const occupe = current.capacite_max - current.capacite_restante;
    const capaciteRestante = Math.max(0, capaciteMax - occupe);

    const { rows: updated } = await query(
      `UPDATE creneaux
       SET date = $1, heure_debut = $2, heure_fin = $3, capacite_max = $4, capacite_restante = $5
       WHERE id = $6 RETURNING *`,
      [
        data.date ?? current.date,
        data.heureDebut ?? current.heure_debut,
        data.heureFin ?? current.heure_fin,
        capaciteMax,
        capaciteRestante,
        req.params.id,
      ]
    );
    res.json(toCreneau(updated[0]));
  })
);

// Supprimer un créneau créé par erreur. Les réservations le référencent :
// dès qu'il en a une, même annulée, il est conservé pour l'historique.
router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT COUNT(*)::int AS total FROM reservations WHERE creneau_id = $1",
      [req.params.id]
    );
    if (rows[0].total > 0) {
      throw new AppError(
        409,
        `Ce créneau a déjà ${rows[0].total} réservation(s) : il ne peut plus être supprimé. Réduisez plutôt sa capacité.`
      );
    }
    const { rowCount } = await query("DELETE FROM creneaux WHERE id = $1", [req.params.id]);
    if (!rowCount) throw new AppError(404, "Créneau introuvable.");
    res.status(204).end();
  })
);

// UC-03 — Consulter les créneaux d'une date, avec état et places restantes (EF-11)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const date = z.string().date().parse(req.query.date);
    const { rows } = await query(
      "SELECT * FROM creneaux WHERE date = $1 ORDER BY heure_debut",
      [date]
    );
    res.json(rows.map(toCreneau));
  })
);

// UC-14 (Gestionnaire) — nombre de réservations par créneau et mode (EF-08)
router.get(
  "/:id/reservations",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS", "ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT mode, COUNT(*)::int AS total
       FROM reservations
       WHERE creneau_id = $1 AND etat NOT IN ('ANNULEE')
       GROUP BY mode`,
      [req.params.id]
    );
    res.json(rows);
  })
);

function toCreneau(row) {
  const occupation = row.capacite_max > 0 ? 1 - row.capacite_restante / row.capacite_max : 0;
  let etat = "disponible";
  if (row.capacite_restante <= 0) etat = "complet";
  else if (occupation >= 0.8) etat = "presque complet";

  return {
    id: row.id,
    date: row.date,
    heureDebut: row.heure_debut,
    heureFin: row.heure_fin,
    capaciteMax: row.capacite_max,
    capaciteRestante: row.capacite_restante,
    etat,
  };
}

export default router;
