import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { FUSEAU } from "../lib/heureMaroc.js";

const router = Router();

// En production, les comptes étudiants viennent du SSO universitaire ou d'une
// liste importée (hypothèse §2.5). Cette route d'inscription sert pour la
// démo / le développement : elle simule la création de compte institutionnel.
const registerSchema = z.object({
  nom: z.string().min(2),
  emailInstitutionnel: z.string().email(),
  motDePasse: z.string().min(6),
  role: z.enum(["ETUDIANT", "AGENT_CONTROLE", "GESTIONNAIRE_REPAS", "ADMINISTRATEUR"]).default("ETUDIANT"),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    const existing = await query(
      "SELECT id FROM utilisateurs WHERE email_institutionnel = $1",
      [data.emailInstitutionnel]
    );
    if (existing.rows.length > 0) {
      throw new AppError(409, "Un compte existe déjà avec cet email institutionnel.");
    }

    const hash = await bcrypt.hash(data.motDePasse, 10);
    const { rows } = await query(
      `INSERT INTO utilisateurs (nom, email_institutionnel, mot_de_passe_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nom, email_institutionnel, role`,
      [data.nom, data.emailInstitutionnel, hash, data.role]
    );
    res.status(201).json(toUser(rows[0]));
  })
);

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
