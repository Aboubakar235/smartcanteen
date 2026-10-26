import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { FUSEAU } from "../lib/heureMaroc.js";

const router = Router();

// EF-01 : pas d'inscription libre. Tous les comptes, étudiants compris, sont
// créés par un administrateur (POST /admin/comptes) ; en production ils
// viendront du SSO universitaire ou d'une liste importée (hypothèse §2.5).

const loginSchema = z.object({
  emailInstitutionnel: z.string().email(),
  motDePasse: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);

    const { rows } = await query(
      "SELECT * FROM utilisateurs WHERE email_institutionnel = $1",
      [data.emailInstitutionnel]
    );
    const user = rows[0];
    // EF-01 : refuser l'accès aux personnes non inscrites, sans révéler si c'est l'email ou le mot de passe.
    if (!user) throw new AppError(401, "Identifiants incorrects.");

    const ok = await bcrypt.compare(data.motDePasse, user.mot_de_passe_hash);
    if (!ok) throw new AppError(401, "Identifiants incorrects.");

    if (user.statut === "suspendu") {
      const msg =
        user.date_fin_suspension && new Date(user.date_fin_suspension) > new Date()
          ? `Compte suspendu jusqu'au ${new Date(user.date_fin_suspension).toLocaleDateString("fr-FR", { timeZone: FUSEAU })} (absences répétées, RG-07).`
          : "Compte suspendu. Contactez l'administration.";
      throw new AppError(403, msg);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, nom: user.nom },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, user: toUser(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query("SELECT * FROM utilisateurs WHERE id = $1", [req.user.id]);
    if (!rows[0]) throw new AppError(404, "Utilisateur introuvable.");
    res.json(toUser(rows[0]));
  })
);

// Chacun peut changer son mot de passe, notamment le mot de passe provisoire
// donné par l'administrateur à la création du compte.
const MOT_DE_PASSE_MIN = 8;
const motDePasseSchema = z.object({
  motDePasseActuel: z.string().min(1),
  nouveauMotDePasse: z.string().min(MOT_DE_PASSE_MIN, `Le nouveau mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères.`),
});

router.post(
  "/mot-de-passe",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = motDePasseSchema.parse(req.body);
    const { rows } = await query("SELECT mot_de_passe_hash FROM utilisateurs WHERE id = $1", [req.user.id]);
    if (!rows[0]) throw new AppError(404, "Utilisateur introuvable.");

    const ok = await bcrypt.compare(data.motDePasseActuel, rows[0].mot_de_passe_hash);
    if (!ok) throw new AppError(400, "Le mot de passe actuel est incorrect.");
    if (data.nouveauMotDePasse === data.motDePasseActuel) {
      throw new AppError(400, "Le nouveau mot de passe doit être différent de l'actuel.");
    }

    const hash = await bcrypt.hash(data.nouveauMotDePasse, 10);
    await query("UPDATE utilisateurs SET mot_de_passe_hash = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ ok: true });
  })
);

function toUser(row) {
  return {
    id: row.id,
    nom: row.nom,
    emailInstitutionnel: row.email_institutionnel,
    role: row.role,
    statut: row.statut,
  };
}

export default router;
