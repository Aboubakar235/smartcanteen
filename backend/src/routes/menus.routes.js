import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../lib/db.js";
import { asyncHandler, AppError } from "../lib/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// UC-12 — Planifier le menu d'une date et d'un service (EF-05)
const SERVICES = ["PETIT_DEJEUNER", "DEJEUNER", "DINER"];

const menuSchema = z.object({
  date: z.string().date(),
  service: z.enum(SERVICES),
  // Facultatif quand le menu existe déjà (simple mise à jour de ses créneaux)
  repasIds: z.array(z.string().uuid()).default([]),
  // Créneaux sur lesquels les repas de ce menu sont servis (choisis par le gestionnaire)
  creneauIds: z.array(z.string().uuid()).min(1, "Choisissez au moins un créneau."),
});

router.post(
  "/",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const data = menuSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      // Un seul menu par date et par service : s'il existe déjà, on y ajoute les
      // repas et on remplace ses créneaux par ceux choisis par le gestionnaire.
      const existing = await client.query(
        "SELECT * FROM menus WHERE date = $1 AND service = $2 FOR UPDATE",
        [data.date, data.service]
      );
      let menu = existing.rows[0];
      const complete = Boolean(menu);
      if (!menu && data.repasIds.length === 0) {
        throw new AppError(400, "Choisissez au moins un repas pour publier un nouveau menu.");
      }
      if (!menu) {
        const { rows } = await client.query(
          "INSERT INTO menus (date, service, cree_par_id) VALUES ($1, $2, $3) RETURNING *",
          [data.date, data.service, req.user.id]
        );
        menu = rows[0];
      }
      for (const repasId of data.repasIds) {
        await client.query(
          "INSERT INTO menu_repas (menu_id, repas_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [menu.id, repasId]
        );
      }

      const creneauIds = [...new Set(data.creneauIds)];
      const { rows: creneauxValides } = await client.query(
        "SELECT id FROM creneaux WHERE id = ANY($1::uuid[]) AND date = $2",
        [creneauIds, data.date]
      );
      if (creneauxValides.length !== creneauIds.length) {
        throw new AppError(400, "Chaque créneau choisi doit exister et être à la date du menu.");
      }
      // Les créneaux publiés sont les seuls où le menu est réservable : on
      // remplace l'ancienne liste. Les réservations déjà faites restent valables.
      await client.query("DELETE FROM menu_creneaux WHERE menu_id = $1", [menu.id]);
      for (const creneauId of creneauIds) {
        await client.query("INSERT INTO menu_creneaux (menu_id, creneau_id) VALUES ($1, $2)", [
          menu.id,
          creneauId,
        ]);
      }
      return { ...menu, creneauIds, complete };
    });

    res.status(result.complete ? 200 : 201).json({
      id: result.id,
      date: result.date,
      service: result.service,
      creneauIds: result.creneauIds,
      complete: result.complete,
    });
  })
);

// UC-09 (Gestionnaire) — dupliquer un menu d'une date vers une autre (EF-09)
router.post(
  "/:id/dupliquer",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const { date: nouvelleDate } = z.object({ date: z.string().date() }).parse(req.body);

    const result = await withTransaction(async (client) => {
      const src = await client.query("SELECT * FROM menus WHERE id = $1", [req.params.id]);
      if (!src.rows[0]) throw new AppError(404, "Menu source introuvable.");

      const existing = await client.query(
        "SELECT id FROM menus WHERE date = $1 AND service = $2",
        [nouvelleDate, src.rows[0].service]
      );
      if (existing.rows.length > 0) {
        throw new AppError(409, "Un menu existe déjà pour la date cible et ce service.");
      }

      const { rows } = await client.query(
        "INSERT INTO menus (date, service, cree_par_id) VALUES ($1, $2, $3) RETURNING *",
        [nouvelleDate, src.rows[0].service, req.user.id]
      );
      const nouveauMenu = rows[0];

      const repasAssocies = await client.query(
        "SELECT repas_id FROM menu_repas WHERE menu_id = $1",
        [req.params.id]
      );
      for (const r of repasAssocies.rows) {
        await client.query("INSERT INTO menu_repas (menu_id, repas_id) VALUES ($1, $2)", [
          nouveauMenu.id,
          r.repas_id,
        ]);
      }

      // Les créneaux sont propres à une date : on reprend ceux de la date
      // cible qui commencent à la même heure que les créneaux du menu source.
      await client.query(
        `INSERT INTO menu_creneaux (menu_id, creneau_id)
         SELECT $1, cible.id
         FROM menu_creneaux mc
         JOIN creneaux source ON source.id = mc.creneau_id
         JOIN creneaux cible ON cible.date = $2 AND cible.heure_debut::time = source.heure_debut::time
         WHERE mc.menu_id = $3
         ON CONFLICT DO NOTHING`,
        [nouveauMenu.id, nouvelleDate, req.params.id]
      );
      return nouveauMenu;
    });

    res.status(201).json({ id: result.id, date: result.date, service: result.service });
  })
);

// Retirer un menu publié. Les repas et les créneaux restent : seule la
// publication disparaît. Refusé tant que des étudiants ont une réservation en
// cours sur ce menu, pour ne pas leur retirer un repas qu'ils attendent.
router.delete(
  "/:id",
  requireAuth,
  requireRole("GESTIONNAIRE_REPAS"),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total
       FROM reservations r
       JOIN menu_repas mr ON mr.repas_id = r.repas_id AND mr.menu_id = $1
       JOIN menu_creneaux mc ON mc.creneau_id = r.creneau_id AND mc.menu_id = $1
       WHERE r.etat IN ('CONFIRMEE', 'EN_ATTENTE', 'APPELEE', 'ENTREE')`,
      [req.params.id]
    );
    if (rows[0].total > 0) {
      throw new AppError(
        409,
        `${rows[0].total} étudiant(s) ont une réservation en cours sur ce menu : il ne peut pas être supprimé.`
      );
    }
    const { rowCount } = await query("DELETE FROM menus WHERE id = $1", [req.params.id]);
    if (!rowCount) throw new AppError(404, "Menu introuvable.");
    res.status(204).end();
  })
);

// UC-02 — Consulter le menu d'une date donnée (EF-10)
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const date = z.string().date().parse(req.query.date);

    // L'ordre de l'énumération donne l'ordre de la journée : petit-déjeuner, déjeuner, dîner.
    const { rows: menus } = await query("SELECT * FROM menus WHERE date = $1 ORDER BY service", [date]);

    const result = [];
    for (const menu of menus) {
      const { rows: repasListe } = await query(
        `SELECT r.* FROM repas r
         JOIN menu_repas mr ON mr.repas_id = r.id
         WHERE mr.menu_id = $1 AND r.disponible = TRUE`,
        [menu.id]
      );
      const { rows: creneauxMenu } = await query(
        `SELECT mc.creneau_id FROM menu_creneaux mc
         JOIN creneaux c ON c.id = mc.creneau_id
         WHERE mc.menu_id = $1
         ORDER BY c.heure_debut`,
        [menu.id]
      );
      result.push({
        id: menu.id,
        date: menu.date,
        service: menu.service,
        creneauIds: creneauxMenu.map((c) => c.creneau_id),
        repas: repasListe.map((r) => ({
          id: r.id,
          nom: r.nom,
          prixIndicatif: Number(r.prix_indicatif),
          quantiteRestante: r.quantite_restante,
        })),
      });
    }
    res.json(result);
  })
);

export default router;
