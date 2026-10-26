import { query } from "./db.js";

let cache = null;
let cacheAt = 0;
const TTL_MS = 30_000; // les paramètres sont modifiables sans redéploiement (EF-38) : petit cache

/** Retourne tous les paramètres sous forme d'objet { cle: valeur(number) }. */
export async function getParametres() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;

  const { rows } = await query("SELECT cle, valeur FROM parametres");
  const obj = {};
  for (const row of rows) {
    const n = Number(row.valeur);
    obj[row.cle] = Number.isNaN(n) ? row.valeur : n;
  }
  cache = obj;
  cacheAt = now;
  return obj;
}

export function invalidateParametresCache() {
  cache = null;
}
