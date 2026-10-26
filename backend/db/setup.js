// Mise en place de la base au démarrage (déploiement) : crée le schéma s'il
// n'existe pas, applique les migrations (rejouables), puis, si SEED_DEMO=true,
// charge les données de démonstration dans une base encore vide.
// Usage : npm run setup
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db.js";

const MIGRATIONS = ["001_petit_dejeuner_creneaux_menu.sql"];

const lireSql = (chemin) => readFile(new URL(chemin, import.meta.url), "utf8");

async function main() {
  const { rows } = await pool.query("SELECT to_regclass('public.utilisateurs') AS table_existe");
  if (!rows[0].table_existe) {
    await pool.query(await lireSql("./schema.sql"));
    console.log("[setup] Schéma créé.");
  }

  for (const migration of MIGRATIONS) {
    await pool.query(await lireSql(`./migrations/${migration}`));
  }
  console.log(`[setup] ${MIGRATIONS.length} migration(s) appliquée(s).`);

  const { rows: comptes } = await pool.query("SELECT count(*)::int AS total FROM utilisateurs");
  await pool.end();

  if (process.env.SEED_DEMO === "true" && comptes[0].total === 0) {
    console.log("[setup] Base vide : chargement des données de démonstration.");
    const seed = fileURLToPath(new URL("./seed.js", import.meta.url));
    const { status } = spawnSync(process.execPath, [seed], { stdio: "inherit" });
    if (status !== 0) throw new Error("Échec du chargement des données de démonstration.");
  }
}

main().catch((err) => {
  console.error("[setup] Échec :", err.message);
  process.exit(1);
});
