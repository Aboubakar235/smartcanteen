import { Router } from "express";
import { query } from "../lib/db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// UC-07 — Gérer ses notifications (EF-24 à EF-28)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT * FROM notifications WHERE destinataire_id = $1 ORDER BY date_envoi DESC LIMIT 50",
      [req.user.id]
    );
    res.json(
      rows.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        dateEnvoi: n.date_envoi,
        lu: n.lu,
      }))
    );
  })
);

router.patch(
  "/:id/lu",
  requireAuth,
  asyncHandler(async (req, res) => {
    await query(
      "UPDATE notifications SET lu = TRUE WHERE id = $1 AND destinataire_id = $2",
      [req.params.id, req.user.id]
    );
    res.status(204).end();
  })
);

export default router;
