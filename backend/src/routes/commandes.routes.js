import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createNotification } from "../services/notifications.service.js";
import { aujourdhuiMaroc } from "../lib/heureMaroc.js";

const router = Router();

// UC-14 — Préparer les commandes à emporter (EF-08, EF-33, EF-34)
router.get(
  "/",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const creneauId = req.query.creneauId;
    const { rows } = await query(
      `SELECT res.*, r.nom AS repas_nom, c.heure_debut
       FROM reservations res
       JOIN repas r ON r.id = res.repas_id
       JOIN creneaux c ON c.id = res.creneau_id
       WHERE res.mode = 'A_EMPORTER' AND res.etat NOT IN ('ANNULEE', 'ABSENTE')
         ${creneauId ? "AND res.creneau_id = $1" : "AND c.heure_debut >= now() - interval '1 day'"}
       ORDER BY c.heure_debut`,
      creneauId ? [creneauId] : []
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        numeroPassage: r.numero_passage,
        repasNom: r.repas_nom,
        heureDebut: r.heure_debut,
        statutCommande: r.statut_commande,
      }))
    );
  })
);

// EF-08 — Repas à servir sur place pour une date, par créneau et par repas, pour
// préparer les quantités. « Entrés » = tickets déjà scannés à l'entrée.
router.get(
  "/sur-place",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const date = z.string().date().optional().parse(req.query.date) ?? aujourdhuiMaroc();
    const { rows } = await query(
      `SELECT c.id AS creneau_id, c.heure_debut, c.heure_fin, r.id AS repas_id, r.nom AS repas_nom,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE res.etat IN ('ENTREE', 'SERVIE', 'TERMINEE'))::int AS entres
       FROM reservations res
       JOIN creneaux c ON c.id = res.creneau_id
       JOIN repas r ON r.id = res.repas_id
       WHERE res.mode = 'SUR_PLACE' AND res.etat NOT IN ('ANNULEE', 'ABSENTE', 'EXPIREE') AND c.date = $1
       GROUP BY c.id, r.id
       ORDER BY c.heure_debut, r.nom`,
      [date]
    );

    const creneaux = [];
    for (const row of rows) {
      let creneau = creneaux.at(-1);
      if (creneau?.id !== row.creneau_id) {
        creneau = { id: row.creneau_id, heureDebut: row.heure_debut, heureFin: row.heure_fin, repas: [] };
        creneaux.push(creneau);
      }
      creneau.repas.push({ id: row.repas_id, nom: row.repas_nom, total: row.total, entres: row.entres });
    }
    res.json({ date, creneaux });
  })
);

router.patch(
  "/:id/statut",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const { statut } = z
      .object({ statut: z.enum(["EN_ATTENTE", "EN_PREPARATION", "PRETE", "RECUPEREE"]) })
      .parse(req.body);

    const { rows } = await query(
      "UPDATE reservations SET statut_commande = $1 WHERE id = $2 AND mode = 'A_EMPORTER' RETURNING *",
      [statut, req.params.id]
    );
    if (!rows[0]) throw new AppError(404, "Commande introuvable.");

    if (statut === "PRETE") {
      await createNotification({
        destinataireId: rows[0].etudiant_id,
        reservationId: rows[0].id,
        type: "commande_prete",
        message: "Votre commande à emporter est prête.",
      });
    }
    res.json({ id: rows[0].id, statutCommande: rows[0].statut_commande });
  })
);

export default router;
