import { Router } from "express";
import { z } from "zod";
import { pool, query, withTransaction } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notifyReservationsDuRepas } from "../services/notifications.service.js";

const router = Router();

// UC-12 — Composer un repas à partir de plusieurs plats (EF-04, EF-06)
const repasSchema = z.object({
  nom: z.string().min(2),
  platIds: z.array(z.string().uuid()).min(1, "Un repas doit contenir au moins un plat."),
  prixIndicatif: z.number().nonnegative().default(0),
  quantiteDisponible: z.number().int().positive(),
});

router.post(
  "/",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const data = repasSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO repas (nom, prix_indicatif, quantite_disponible, quantite_restante, cree_par_id)
         VALUES ($1, $2, $3, $3, $4) RETURNING *`,
        [data.nom, data.prixIndicatif, data.quantiteDisponible, req.user.id]
      );
      const repas = rows[0];
      for (const platId of data.platIds) {
        await client.query(
          "INSERT INTO repas_plats (repas_id, plat_id) VALUES ($1, $2)",
          [repas.id, platId]
        );
      }
      return repas;
    });

    res.status(201).json(toRepas(result));
  })
);

// UC-13 — Signaler un repas indisponible (EF-07, EF-27)
router.post(
  "/:id/indisponible",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "UPDATE repas SET disponible = FALSE WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!rows[0]) throw new AppError(404, "Repas introuvable.");

    // RG-10 : un repas devenu indisponible entraîne l'information de tous les étudiants concernés.
    const notifiees = await notifyReservationsDuRepas(req.params.id);

    res.json({ repas: toRepas(rows[0]), etudiantsNotifies: notifiees });
  })
);

// Repas disponibles, du plus récent au plus ancien, pour composer un menu
router.get(
  "/",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const { rows } = await query("SELECT * FROM repas WHERE disponible = TRUE ORDER BY created_at DESC");
    res.json(rows.map(toRepas));
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query("SELECT * FROM repas WHERE id = $1", [req.params.id]);
    if (!rows[0]) throw new AppError(404, "Repas introuvable.");
    const plats = await query(
      `SELECT p.* FROM plats p
       JOIN repas_plats rp ON rp.plat_id = p.id
       WHERE rp.repas_id = $1`,
      [req.params.id]
    );
    res.json({ ...toRepas(rows[0]), plats: plats.rows });
  })
);

function toRepas(row) {
  return {
    id: row.id,
    nom: row.nom,
    prixIndicatif: Number(row.prix_indicatif),
    quantiteDisponible: row.quantite_disponible,
    quantiteRestante: row.quantite_restante,
    disponible: row.disponible,
  };
}

export default router;
