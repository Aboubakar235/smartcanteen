// TECH-13 : les heures sont stockées en UTC et exprimées à l'heure du Maroc.
// Les calculs de fuseau se font ici, avec la base de fuseaux de Node (à jour),
// jamais dans PostgreSQL dont la base de fuseaux peut être plus ancienne.
export const FUSEAU = "Africa/Casablanca";

function composantesMaroc(instant) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
}

/** Décalage du Maroc par rapport à UTC à un instant donné, en minutes (0 ou 60). */
export function decalageMarocMinutes(instant = new Date()) {
  const vu = composantesMaroc(instant);
  const vuCommeUtc = Date.UTC(vu.year, vu.month - 1, vu.day, vu.hour, vu.minute);
  return Math.round((vuCommeUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000);
}

/** Date du jour au Maroc, au format AAAA-MM-JJ. */
export function aujourdhuiMaroc() {
  const { year, month, day } = composantesMaroc(new Date());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Instant (Date) correspondant à une date et une heure murale du Maroc. */
export function instantMaroc(date, hhmm) {
  const [annee, mois, jour] = date.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  const voulu = Date.UTC(annee, mois - 1, jour, h, m);
  let instant = voulu;
  // Deux passes suffisent, y compris autour d'un changement d'heure.
  for (let i = 0; i < 2; i++) {
    const vu = composantesMaroc(new Date(instant));
    instant += voulu - Date.UTC(vu.year, vu.month - 1, vu.day, vu.hour, vu.minute);
  }
  return new Date(instant);
}
