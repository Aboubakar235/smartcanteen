import { query } from "../lib/db.js";

/**
 * Crée une notification, sauf si une notification du même type pour le même
 * événement (même réservation) a déjà été envoyée (EF-26 : pas de doublon).
 *
 * Appelée depuis une transaction, il faut passer son `client` : sinon l'INSERT
 * part sur une autre connexion du pool et attend le verrou que la transaction
 * détient sur la réservation, qui elle-même attend l'INSERT (interblocage).
 */
export async function createNotification({ destinataireId, reservationId = null, type, message }, db = { query }) {
  if (reservationId) {
    const existing = await db.query(
      `SELECT id FROM notifications
       WHERE destinataire_id = $1 AND reservation_id = $2 AND type = $3`,
      [destinataireId, reservationId, type]
    );
    if (existing.rows.length > 0) return existing.rows[0];
  }

  const { rows } = await db.query(
    `INSERT INTO notifications (destinataire_id, reservation_id, type, message)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [destinataireId, reservationId, type, message]
  );
  return rows[0];
}

/**
 * RG-10 / EF-27 : notifie tous les étudiants ayant une réservation active
 * (non terminée/annulée) sur un repas devenu indisponible, et leur propose
 * un repas de remplacement ou l'annulation sans pénalité.
 */
export async function notifyReservationsDuRepas(repasId) {
  const { rows } = await query(
    `SELECT id, etudiant_id FROM reservations
     WHERE repas_id = $1 AND etat IN ('CONFIRMEE', 'EN_ATTENTE', 'APPELEE')`,
    [repasId]
  );

  for (const r of rows) {
    await createNotification({
      destinataireId: r.etudiant_id,
      reservationId: r.id,
      type: "indisponibilite",
      message:
        "Le repas de votre réservation n'est plus disponible. Vous pouvez choisir un repas de remplacement ou annuler sans pénalité.",
    });
  }
  return rows.length;
}
