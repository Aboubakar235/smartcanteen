import { withTransaction, query } from "../lib/db.js";
import { AppError } from "../lib/asyncHandler.js";
import { getParametres } from "../lib/params.js";
import { genererJetonQr, fenetreValiditeTicket } from "./ticket.service.js";
import { createNotification } from "./notifications.service.js";

/**
 * UC-04 — Réserver un passage (EF-12 à EF-15).
 * Reprend le scénario du diagramme de séquence : verrouillage transactionnel
 * (SELECT FOR UPDATE) pour empêcher tout dépassement de capacité ou de
 * quantité même en réservations simultanées (EF-13, ENF-05).
 */
export async function creerReservation({ etudiantId, creneauId, repasId, mode }) {
  const params = await getParametres();

  const creneauInfo = await query("SELECT * FROM creneaux WHERE id = $1", [creneauId]);
  if (!creneauInfo.rows[0]) throw new AppError(404, "Créneau introuvable.");
  const creneau = creneauInfo.rows[0];

  // EF-15 / §6.1 : fenêtre d'anticipation et fermeture avant le créneau.
  const maintenant = new Date();
  const debutCreneau = new Date(creneau.heure_debut);
  const anticipationMaxMs = params.anticipation_max_jours * 24 * 60 * 60_000;
  const fermetureMs = params.fermeture_min_avant_creneau * 60_000;
  if (debutCreneau.getTime() - maintenant.getTime() > anticipationMaxMs) {
    throw new AppError(400, "Ce créneau est trop éloigné : la réservation n'est possible que 2 jours à l'avance.");
  }
  if (debutCreneau.getTime() - maintenant.getTime() < fermetureMs) {
    throw new AppError(400, "Les réservations pour ce créneau sont fermées (moins de 30 minutes avant le passage).");
  }

  // Le repas doit être servi sur ce créneau : le gestionnaire a lié les
  // créneaux au menu (date + service) qui contient ce repas.
  const menuInfo = await query(
    `SELECT m.id, m.service FROM menus m
     JOIN menu_repas mr ON mr.menu_id = m.id
     JOIN menu_creneaux mc ON mc.menu_id = m.id
     WHERE mr.repas_id = $1 AND mc.creneau_id = $2`,
    [repasId, creneauId]
  );
  if (!menuInfo.rows[0]) {
    throw new AppError(400, "Ce repas n'est pas servi sur ce créneau. Choisissez un autre horaire.");
  }
  const menu = menuInfo.rows[0];

  // RG-01 : une seule réservation active par étudiant, par service et par jour.
  const actives = await query(
    `SELECT DISTINCT res.id FROM reservations res
     JOIN creneaux c ON c.id = res.creneau_id
     JOIN menu_repas mr ON mr.repas_id = res.repas_id
     JOIN menus m ON m.id = mr.menu_id AND m.date = c.date
     WHERE res.etudiant_id = $1 AND c.date = $2 AND m.service = $3
       AND res.etat IN ('CONFIRMEE', 'EN_ATTENTE', 'APPELEE')`,
    [etudiantId, creneau.date, menu.service]
  );
  if (actives.rows.length >= params.reservations_actives_max) {
    throw new AppError(
      409,
      "Vous avez déjà une réservation active pour ce service aujourd'hui (limite : 1 par service et par jour)."
    );
  }

  try {
    return await withTransaction(async (client) => {
      // Verrouillage pessimiste : empêche toute réservation concurrente de
      // lire une capacité/quantité périmée (EF-13).
      const { rows: creneauLock } = await client.query(
        "SELECT * FROM creneaux WHERE id = $1 FOR UPDATE",
        [creneauId]
      );
      const { rows: repasLock } = await client.query(
        "SELECT * FROM repas WHERE id = $1 FOR UPDATE",
        [repasId]
      );
      const c = creneauLock[0];
      const r = repasLock[0];
      if (!r) throw new AppError(404, "Repas introuvable.");

      if (c.capacite_restante <= 0) {
        throw new AppError(409, "Créneau complet.", { code: "CRENEAU_COMPLET" });
      }
      if (!r.disponible || r.quantite_restante <= 0) {
        throw new AppError(409, "Repas épuisé ou indisponible.", { code: "REPAS_EPUISE" });
      }

      await client.query(
        "UPDATE creneaux SET capacite_restante = capacite_restante - 1 WHERE id = $1",
        [creneauId]
      );
      await client.query(
        "UPDATE repas SET quantite_restante = quantite_restante - 1 WHERE id = $1",
        [repasId]
      );

      const numeroPassage = await genererNumeroPassage(client, c.date);

      const { rows: resRows } = await client.query(
        `INSERT INTO reservations (numero_passage, mode, etat, statut_commande, etudiant_id, creneau_id, repas_id)
         VALUES ($1, $2, 'CONFIRMEE', $3, $4, $5, $6) RETURNING *`,
        [
          numeroPassage,
          mode,
          mode === "A_EMPORTER" ? "EN_ATTENTE" : null,
          etudiantId,
          creneauId,
          repasId,
        ]
      );
      const reservation = resRows[0];

      await client.query(
        "INSERT INTO historique_etats (reservation_id, etat, auteur) VALUES ($1, 'CONFIRMEE', 'etudiant')",
        [reservation.id]
      );

      // EF-18, EF-19 : numéro de passage + QR Code dès la confirmation.
      const { debut: validiteDebut, fin: validiteFin } = await fenetreValiditeTicket(
        new Date(c.heure_debut),
        new Date(c.heure_fin)
      );
      const qrCodeJeton = genererJetonQr(reservation.id, validiteFin);

      const { rows: ticketRows } = await client.query(
        `INSERT INTO tickets (reservation_id, qr_code_jeton, validite_debut, validite_fin)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [reservation.id, qrCodeJeton, validiteDebut, validiteFin]
      );

      return { reservation, ticket: ticketRows[0] };
    });
  } catch (err) {
    if (err instanceof AppError && err.details?.code === "CRENEAU_COMPLET") {
      err.alternatives = await suggererAlternatives(menu.id);
    }
    throw err;
  }
}

/** EF-14 : en cas d'échec, propose les autres créneaux libres du même menu. */
async function suggererAlternatives(menuId) {
  const { rows } = await query(
    `SELECT c.id, c.heure_debut, c.heure_fin, c.capacite_restante FROM creneaux c
     JOIN menu_creneaux mc ON mc.creneau_id = c.id
     WHERE mc.menu_id = $1 AND c.capacite_restante > 0
     ORDER BY c.heure_debut LIMIT 5`,
    [menuId]
  );
  return rows.map((c) => ({
    id: c.id,
    heureDebut: c.heure_debut,
    heureFin: c.heure_fin,
    capaciteRestante: c.capacite_restante,
  }));
}

/** RG-03 : numéro de passage unique par jour, format ex. A127. */
async function genererNumeroPassage(client, date) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS total FROM reservations res
     JOIN creneaux c ON c.id = res.creneau_id
     WHERE c.date = $1`,
    [date]
  );
  const n = rows[0].total + 1;
  return `A${String(n).padStart(3, "0")}`;
}

/** UC-08 — Annuler une réservation (EF-17, RG-11). */
export async function annulerReservation(reservationId, etudiantId) {
  const params = await getParametres();

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT res.*, c.heure_debut FROM reservations res
       JOIN creneaux c ON c.id = res.creneau_id
       WHERE res.id = $1 FOR UPDATE`,
      [reservationId]
    );
    const reservation = rows[0];
    if (!reservation) throw new AppError(404, "Réservation introuvable.");
    if (reservation.etudiant_id !== etudiantId) throw new AppError(403, "Cette réservation ne vous appartient pas.");
    if (!["CONFIRMEE", "EN_ATTENTE"].includes(reservation.etat)) {
      throw new AppError(409, "Cette réservation ne peut plus être annulée.");
    }

    const delaiMs = params.delai_modif_annulation_min * 60_000;
    const dansLesDelais = new Date(reservation.heure_debut).getTime() - Date.now() >= delaiMs;

    // RG-11 : une annulation tardive compte comme une absence.
    const nouvelEtat = dansLesDelais ? "ANNULEE" : "ABSENTE";

    await client.query(
      "UPDATE reservations SET etat = $1, date_annulation = now() WHERE id = $2",
      [nouvelEtat, reservationId]
    );
    await client.query(
      "INSERT INTO historique_etats (reservation_id, etat, auteur) VALUES ($1, $2, 'etudiant')",
      [reservationId, nouvelEtat]
    );
    // la place et la quantité sont libérées dans tous les cas.
    await client.query(
      "UPDATE creneaux SET capacite_restante = capacite_restante + 1 WHERE id = $1",
      [reservation.creneau_id]
    );
    await client.query(
      "UPDATE repas SET quantite_restante = quantite_restante + 1 WHERE id = $1",
      [reservation.repas_id]
    );

    if (!dansLesDelais) {
      await appliquerAbsence(client, etudiantId, params);
    }

    return { etat: nouvelEtat, dansLesDelais };
  });
}

/**
 * RG-07 : après le nombre d'absences répétées fixé (par défaut 3 en 30
 * jours), les réservations de l'étudiant sont suspendues.
 * Simplification MVP assumée : compteur cumulatif remis à zéro à chaque
 * suspension, plutôt qu'une fenêtre glissante stricte de 30 jours.
 */
async function appliquerAbsence(client, etudiantId, params) {
  const { rows } = await client.query(
    "UPDATE utilisateurs SET absences_recentes = absences_recentes + 1 WHERE id = $1 RETURNING absences_recentes",
    [etudiantId]
  );
  if (rows[0].absences_recentes >= params.absences_suspension_seuil) {
    const finSuspension = new Date(Date.now() + params.suspension_duree_jours * 24 * 60 * 60_000);
    await client.query(
      "UPDATE utilisateurs SET statut = 'suspendu', date_fin_suspension = $1, absences_recentes = 0 WHERE id = $2",
      [finSuspension, etudiantId]
    );
  }
}

/** UC-10 (Agent) — marque une réservation "absente" après dépassement de tolérance (RG-05, RG-06). */
export async function marquerAbsencesExpirees() {
  const params = await getParametres();
  const seuilMs = params.absence_apres_depassement_min * 60_000;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT res.id, res.etudiant_id, res.creneau_id, res.repas_id, c.heure_fin
       FROM reservations res JOIN creneaux c ON c.id = res.creneau_id
       WHERE res.etat IN ('CONFIRMEE', 'EN_ATTENTE', 'APPELEE')
         AND c.heure_fin + ($1 || ' milliseconds')::interval < now()
       FOR UPDATE OF res`,
      [seuilMs]
    );

    for (const r of rows) {
      await client.query("UPDATE reservations SET etat = 'ABSENTE' WHERE id = $1", [r.id]);
      await client.query(
        "INSERT INTO historique_etats (reservation_id, etat, auteur) VALUES ($1, 'ABSENTE', 'systeme')",
        [r.id]
      );
      await client.query(
        "UPDATE creneaux SET capacite_restante = capacite_restante + 1 WHERE id = $1",
        [r.creneau_id]
      );
      await client.query(
        "UPDATE repas SET quantite_restante = quantite_restante + 1 WHERE id = $1",
        [r.repas_id]
      );
      await appliquerAbsence(client, r.etudiant_id, params);
      await createNotification(
        {
          destinataireId: r.etudiant_id,
          reservationId: r.id,
          type: "absence",
          message: "Votre réservation a été marquée comme absente (non-présentation après tolérance).",
        },
        client
      );
    }
    return rows.length;
  });
}

/** UC-06 — Suivi de file (EF-21, EF-22, RG-08). */
export async function positionDansLaFile(reservationId) {
  const params = await getParametres();
  const { rows } = await query("SELECT * FROM reservations WHERE id = $1", [reservationId]);
  const reservation = rows[0];
  if (!reservation) throw new AppError(404, "Réservation introuvable.");

  // RG-03 : la file est ordonnée par créneau puis par numéro de passage ;
  // la position = nombre de personnes non servies qui le précèdent, +1.
  const { rows: devant } = await query(
    `SELECT COUNT(*)::int AS total FROM reservations
     WHERE creneau_id = $1
       AND etat IN ('CONFIRMEE', 'EN_ATTENTE', 'APPELEE')
       AND numero_passage < $2`,
    [reservation.creneau_id, reservation.numero_passage]
  );

  // RG-08 : temps d'attente estimé = personnes devant × durée moyenne de service
  // (moyenne des 15 dernières validations ; 45 s par défaut si pas d'historique).
  const dureeMoyenneMs = await dureeMoyenneDeService();
  const position = devant[0].total + 1;
  const personnesDevant = position - 1;

  // EF-24 : notifier l'étudiant quand son passage approche (seuil configurable, §6.1).
  if (personnesDevant <= params.seuil_notification_approche) {
    await createNotification({
      destinataireId: reservation.etudiant_id,
      reservationId: reservation.id,
      type: "approche",
      message: `Votre tour approche : ${personnesDevant} personne(s) devant vous.`,
    });
  }

  return {
    position,
    tempsAttenteEstimeSec: Math.round(personnesDevant * (dureeMoyenneMs / 1000)),
  };
}

async function dureeMoyenneDeService() {
  const { rows } = await query(
    `SELECT date_utilisation FROM tickets
     WHERE date_utilisation IS NOT NULL
     ORDER BY date_utilisation DESC LIMIT 15`
  );
  if (rows.length < 2) return 45_000; // valeur par défaut (§6.1)

  let total = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    total += Math.abs(new Date(rows[i].date_utilisation) - new Date(rows[i + 1].date_utilisation));
  }
  const moyenne = total / (rows.length - 1);
  return Math.min(moyenne, 5 * 60_000); // garde-fou : jamais plus de 5 min/passage
}
