import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../src/lib/db.js";
import { aujourdhuiMaroc, instantMaroc } from "../src/lib/heureMaroc.js";

async function seed() {
  const hash = await bcrypt.hash("password123", 10);

  const users = [
    ["Fatima Zahra (Administratrice)", "admin@um5.ac.ma", "ADMINISTRATEUR"],
    ["Karim Bennani (Gestionnaire)", "gestionnaire@um5.ac.ma", "GESTIONNAIRE_REPAS"],
    ["Sara El Amrani (Agent)", "agent@um5.ac.ma", "AGENT_CONTROLE"],
    ["Yassine Idrissi (Étudiant)", "etudiant@um5.ac.ma", "ETUDIANT"],
  ];

  const ids = {};
  for (const [nom, email, role] of users) {
    const { rows } = await pool.query(
      `INSERT INTO utilisateurs (nom, email_institutionnel, mot_de_passe_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email_institutionnel) DO UPDATE SET nom = EXCLUDED.nom
       RETURNING id, role`,
      [nom, email, hash, role]
    );
    ids[role] = rows[0].id;
  }

  const plats = [
    ["Tajine de poulet", "plat principal", ["gluten"]],
    ["Salade marocaine", "entrée", []],
    ["Fruit de saison", "dessert", []],
    ["Couscous légumes", "plat principal", ["gluten"]],
  ];
  const platIds = [];
  for (const [nom, categorie, allergenes] of plats) {
    const { rows } = await pool.query(
      `INSERT INTO plats (nom, categorie, allergenes, cree_par_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [nom, categorie, allergenes, ids.GESTIONNAIRE_REPAS]
    );
    platIds.push(rows[0].id);
  }

  const { rows: repasRows } = await pool.query(
    `INSERT INTO repas (nom, prix_indicatif, quantite_disponible, quantite_restante, cree_par_id)
     VALUES ($1, $2, $3, $3, $4) RETURNING id`,
    ["Menu du jour — Tajine", 25.0, 80, ids.GESTIONNAIRE_REPAS]
  );
  const repasId = repasRows[0].id;
  await pool.query("INSERT INTO repas_plats (repas_id, plat_id) VALUES ($1, $2), ($1, $3)", [
    repasId,
    platIds[0],
    platIds[1],
  ]);

  const today = aujourdhuiMaroc();
  const { rows: menuRows } = await pool.query(
    `INSERT INTO menus (date, service, cree_par_id) VALUES ($1, 'DEJEUNER', $2)
     ON CONFLICT (date, service) DO UPDATE SET date = EXCLUDED.date RETURNING id`,
    [today, ids.GESTIONNAIRE_REPAS]
  );
  await pool.query(
    "INSERT INTO menu_repas (menu_id, repas_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [menuRows[0].id, repasId]
  );

  // Créneaux du jour, puis rattachement de chaque menu à ses créneaux
  async function creerCreneaux(plages) {
    const creneauIds = [];
    for (const [debut, fin] of plages) {
      const { rows } = await pool.query(
        `INSERT INTO creneaux (date, heure_debut, heure_fin, capacite_max, capacite_restante, gere_par_id)
         VALUES ($1, $2, $3, 60, 60, $4) RETURNING id`,
        [today, instantMaroc(today, debut), instantMaroc(today, fin), ids.ADMINISTRATEUR]
      );
      creneauIds.push(rows[0].id);
    }
    return creneauIds;
  }

  async function lierCreneaux(menuId, creneauIds) {
    for (const creneauId of creneauIds) {
      await pool.query(
        "INSERT INTO menu_creneaux (menu_id, creneau_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [menuId, creneauId]
      );
    }
  }

  const creneauxDejeuner = await creerCreneaux([
    ["12:00", "12:30"],
    ["12:30", "13:00"],
    ["13:00", "13:30"],
  ]);
  await lierCreneaux(menuRows[0].id, creneauxDejeuner);

  // Petit-déjeuner : un repas, son menu et ses deux créneaux
  const { rows: petitDejRows } = await pool.query(
    `INSERT INTO repas (nom, prix_indicatif, quantite_disponible, quantite_restante, cree_par_id)
     VALUES ($1, $2, $3, $3, $4) RETURNING id`,
    ["Msemen, œuf et thé à la menthe", 8.0, 60, ids.GESTIONNAIRE_REPAS]
  );
  const { rows: menuPetitDej } = await pool.query(
    `INSERT INTO menus (date, service, cree_par_id) VALUES ($1, 'PETIT_DEJEUNER', $2)
     ON CONFLICT (date, service) DO UPDATE SET date = EXCLUDED.date RETURNING id`,
    [today, ids.GESTIONNAIRE_REPAS]
  );
  await pool.query(
    "INSERT INTO menu_repas (menu_id, repas_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [menuPetitDej[0].id, petitDejRows[0].id]
  );
  const creneauxPetitDej = await creerCreneaux([
    ["07:30", "08:00"],
    ["08:00", "08:30"],
  ]);
  await lierCreneaux(menuPetitDej[0].id, creneauxPetitDej);

  console.log("Seed terminé. Comptes de test (mot de passe : password123) :");
  for (const [, email, role] of users) console.log(` - ${email} (${role})`);

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
