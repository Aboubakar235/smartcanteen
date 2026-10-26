// Helpers d'affichage partagés par toutes les pages.
// TECH-13 : les heures sont stockées en UTC et affichées à l'heure du Maroc.
// Le décalage vient du serveur (synchroniserHeure) : la base de fuseaux d'un
// téléphone peut être périmée, celle du serveur fait foi pour toute la cantine.
export const FUSEAU = "Africa/Casablanca";

const MINUTE = 60_000;

// Décalage vu par le navigateur, utilisé tant que le serveur n'a pas répondu
function decalageNavigateurMs(instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
  const vuCommeUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute);
  return Math.round((vuCommeUtc - instant.getTime()) / MINUTE) * MINUTE;
}

let decalageMs = decalageNavigateurMs();

/** Récupère le décalage du Maroc auprès du serveur (à appeler au démarrage). */
export async function synchroniserHeure(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/heure`);
    const { decalageMinutes } = await res.json();
    if (Number.isFinite(decalageMinutes)) decalageMs = decalageMinutes * MINUTE;
  } catch {
    // Serveur injoignable : on garde le décalage du navigateur.
  }
}

// Un instant décalé à l'heure du Maroc : ses composantes UTC sont l'heure murale.
function versMaroc(instant) {
  return new Date(new Date(instant).getTime() + decalageMs);
}

const deux = (n) => String(n).padStart(2, "0");

// Date du jour au Maroc, au format AAAA-MM-JJ attendu par l'API
export function aujourdhui() {
  const d = versMaroc(Date.now());
  return `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
}

// Instant ISO (UTC) correspondant à une date et une heure murale du Maroc,
// par exemple ("2026-06-15", "12:00") → "2026-06-15T11:00:00.000Z" à UTC+1.
export function instantMaroc(date, hhmm) {
  const [annee, mois, jour] = date.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(annee, mois - 1, jour, h, m) - decalageMs).toISOString();
}

// "HH:MM" à l'heure du Maroc, à partir d'un horodatage renvoyé par l'API
export function heure(iso) {
  const d = versMaroc(iso);
  return `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}`;
}

export function plage(debut, fin) {
  return `${heure(debut)} – ${heure(fin)}`;
}

// Une date AAAA-MM-JJ désigne déjà un jour du Maroc ; un instant y est ramené.
function jourMaroc(date) {
  return typeof date === "string" ? new Date(`${date}T12:00:00Z`) : versMaroc(date);
}

// "dimanche 25 octobre"
export function dateLongue(date = new Date()) {
  return jourMaroc(date).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

// "25 oct."
export function dateCourte(date) {
  return jourMaroc(date).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
}

// "25 oct., 13:05"
export function dateHeure(iso) {
  return versMaroc(iso).toLocaleString("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function prenom(nom = "") {
  return nom.split(" ")[0];
}

export function initiales(nom = "") {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("");
}

export const SERVICE_LABEL = { PETIT_DEJEUNER: "Petit-déjeuner", DEJEUNER: "Déjeuner", DINER: "Dîner" };

export const MODE_LABEL = { SUR_PLACE: "Sur place", A_EMPORTER: "À emporter" };

// Libellé et ton visuel de chaque état de réservation (§7 du cahier des charges).
export const ETAT_RESERVATION = {
  CONFIRMEE: { label: "Confirmée", tone: "accent" },
  EN_ATTENTE: { label: "En attente", tone: "accent" },
  APPELEE: { label: "Appelée", tone: "warn" },
  ENTREE: { label: "Entrée", tone: "success" },
  SERVIE: { label: "Servie", tone: "success" },
  TERMINEE: { label: "Terminée", tone: "" },
  ANNULEE: { label: "Annulée", tone: "" },
  ABSENTE: { label: "Absence", tone: "danger" },
  EXPIREE: { label: "Expirée", tone: "" },
};

export const ETATS_ACTIFS = ["CONFIRMEE", "EN_ATTENTE", "APPELEE"];

export const ETAT_CRENEAU = {
  disponible: { label: "Disponible", tone: "success" },
  "presque complet": { label: "Presque complet", tone: "warn" },
  complet: { label: "Complet", tone: "danger" },
};
