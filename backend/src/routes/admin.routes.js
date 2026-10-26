import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getParametres, invalidateParametresCache } from "../lib/params.js";

const router = Router();

// UC-16 — Gérer les comptes (EF-39). L'administrateur crée tous les comptes,
// étudiants compris, avec un mot de passe provisoire que chacun change ensuite.
const MOT_DE_PASSE_MIN = 8;
const compteSchema = z.object({
  nom: z.string().min(2),
  emailInstitutionnel: z.string().email(),
  motDePasse: z.string().min(MOT_DE_PASSE_MIN, `Le mot de passe provisoire doit contenir au moins ${MOT_DE_PASSE_MIN} caractères.`),
  role: z.enum(["ETUDIANT", "AGENT_CONTROLE", "GESTIONNAIRE_REPAS", "ADMINISTRATEUR"]),
});

router.post(
  "/comptes",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const data = compteSchema.parse(req.body);
    const existing = await query("SELECT id FROM utilisateurs WHERE email_institutionnel = $1", [
      data.emailInstitutionnel,
    ]);
    if (existing.rows.length > 0) throw new AppError(409, "Cet email est déjà utilisé.");

    const hash = await bcrypt.hash(data.motDePasse, 10);
    const { rows } = await query(
      `INSERT INTO utilisateurs (nom, email_institutionnel, mot_de_passe_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, nom, email_institutionnel, role, statut`,
      [data.nom, data.emailInstitutionnel, hash, data.role]
    );
    res.status(201).json(rows[0]);
  })
);

router.get(
  "/comptes",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT id, nom, email_institutionnel, role, statut FROM utilisateurs ORDER BY role, nom"
    );
    res.json(rows);
  })
);

router.patch(
  "/comptes/:id/statut",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const { statut } = z.object({ statut: z.enum(["actif", "suspendu"]) }).parse(req.body);
    // Un administrateur qui se suspendrait lui-même ne pourrait plus le défaire.
    if (req.params.id === req.user.id && statut === "suspendu") {
      throw new AppError(400, "Vous ne pouvez pas suspendre votre propre compte.");
    }
    const { rows } = await query(
      "UPDATE utilisateurs SET statut = $1 WHERE id = $2 RETURNING id, statut",
      [statut, req.params.id]
    );
    if (!rows[0]) throw new AppError(404, "Compte introuvable.");
    res.json(rows[0]);
  })
);

// Mot de passe oublié : l'administrateur donne un nouveau mot de passe provisoire.
router.patch(
  "/comptes/:id/mot-de-passe",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const { motDePasse } = z
      .object({ motDePasse: z.string().min(MOT_DE_PASSE_MIN, `Le mot de passe provisoire doit contenir au moins ${MOT_DE_PASSE_MIN} caractères.`) })
      .parse(req.body);
    const hash = await bcrypt.hash(motDePasse, 10);
    const { rows } = await query(
      "UPDATE utilisateurs SET mot_de_passe_hash = $1 WHERE id = $2 RETURNING id",
      [hash, req.params.id]
    );
    if (!rows[0]) throw new AppError(404, "Compte introuvable.");
    res.json({ ok: true });
  })
);

// UC-15 — Paramètres du système (EF-38 : sans redéploiement)
router.get(
  "/parametres",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    res.json(await getParametres());
  })
);

router.patch(
  "/parametres/:cle",
  requireAuth,
  requireRole("ADMINISTRATEUR"),
  asyncHandler(async (req, res) => {
    const { valeur } = z.object({ valeur: z.string() }).parse(req.body);
    const { rows } = await query(
      "UPDATE parametres SET valeur = $1 WHERE cle = $2 RETURNING *",
      [valeur, req.params.cle]
    );
    if (!rows[0]) throw new AppError(404, "Paramètre introuvable.");
    invalidateParametresCache();
    res.json(rows[0]);
  })
);

// UC-17 — Consulter les statistiques (EF-40)
router.get(
  "/statistiques",
  requireAuth,
  requireRole("ADMINISTRATEUR", "GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const date = req.query.date;
    const params = date ? [date] : [];
    const whereDate = date ? "WHERE c.date = $1" : "";

    const [affluence, absences, repasPopulaires] = await Promise.all([
      query(
        `SELECT c.date, COUNT(res.id)::int AS total_reservations
         FROM creneaux c LEFT JOIN reservations res ON res.creneau_id = c.id AND res.etat != 'ANNULEE'
         ${whereDate} GROUP BY c.date ORDER BY c.date DESC LIMIT 14`,
        params
      ),
      query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE etat = 'ABSENTE')::int AS absents
         FROM reservations res JOIN creneaux c ON c.id = res.creneau_id
         ${whereDate}`,
        params
      ),
      query(
        `SELECT r.nom, COUNT(res.id)::int AS total
         FROM reservations res
         JOIN repas r ON r.id = res.repas_id
         JOIN creneaux c ON c.id = res.creneau_id
         ${whereDate}
         GROUP BY r.nom ORDER BY total DESC LIMIT 5`,
        params
      ),
    ]);

    const tauxAbsence = absences.rows[0].total > 0
      ? absences.rows[0].absents / absences.rows[0].total
      : 0;

    res.json({
      affluenceParJour: affluence.rows,
      tauxAbsence,
      repasLesPlusDemandes: repasPopulaires.rows,
    });
  })
);

export default router;
