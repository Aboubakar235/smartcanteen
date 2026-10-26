import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// UC-11 — Gérer les plats (EF-03)
const platSchema = z.object({
  nom: z.string().min(2),
  description: z.string().optional(),
  categorie: z.string().min(2),
  allergenes: z.array(z.string()).default([]),
  photoUrl: z.string().url().optional(),
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT * FROM plats WHERE actif = TRUE ORDER BY categorie, nom"
    );
    res.json(rows.map(toPlat));
  })
);

router.post(
  "/",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const data = platSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO plats (nom, description, categorie, allergenes, photo_url, cree_par_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.nom, data.description ?? null, data.categorie, data.allergenes, data.photoUrl ?? null, req.user.id]
    );
    res.status(201).json(toPlat(rows[0]));
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const data = platSchema.partial().parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, col] of [
      ["nom", "nom"],
      ["description", "description"],
      ["categorie", "categorie"],
      ["allergenes", "allergenes"],
      ["photoUrl", "photo_url"],
    ]) {
      if (data[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) throw new AppError(400, "Aucune donnée à mettre à jour.");
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE plats SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) throw new AppError(404, "Plat introuvable.");
    res.json(toPlat(rows[0]));
  })
);

// désactiver un plat (EF-03 : créer, modifier, désactiver)
router.delete(
  "/:id",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "UPDATE plats SET actif = FALSE WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) throw new AppError(404, "Plat introuvable.");
    res.status(204).end();
  })
);

function toPlat(row) {
  return {
    id: row.id,
    nom: row.nom,
    description: row.description,
    categorie: row.categorie,
    allergenes: row.allergenes,
    photoUrl: row.photo_url,
    actif: row.actif,
  };
}

export default router;
