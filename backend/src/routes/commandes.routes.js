import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createNotification } from "../services/notifications.service.js";

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
