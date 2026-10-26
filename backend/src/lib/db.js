import pg from "pg";
import "dotenv/config";

const { Pool, types } = pg;

// Les colonnes de type DATE (sans heure) sont renvoyées telles quelles
// ("YYYY-MM-DD") plutôt que converties en objet Date, pour éviter tout
// décalage de fuseau horaire au moment de l'affichage côté client.
types.setTypeParser(1082, (val) => val);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/** Exécute une requête simple (hors transaction). */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Exécute une fonction dans une transaction SQL (BEGIN/COMMIT/ROLLBACK).
 * `fn` reçoit un client dédié ; toute requête doit passer par ce client
 * pour rester dans la même transaction (utilisé notamment par la
 * réservation, EF-13 / ENF-05 : verrouillage pessimiste SELECT FOR UPDATE).
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
