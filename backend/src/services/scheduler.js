import { marquerAbsencesExpirees } from "./reservations.service.js";

/**
 * TECH-09 : planificateur pour le marquage des absences (RG-05, RG-06).
 * Une tâche périodique suffit pour le MVP (pas de cron système nécessaire).
 */
export function demarrerPlanificateur() {
  const INTERVALLE_MS = 60_000;
  setInterval(async () => {
    try {
      const n = await marquerAbsencesExpirees();
      if (n > 0) console.log(`[planificateur] ${n} réservation(s) marquée(s) absente(s).`);
    } catch (err) {
      console.error("[planificateur] erreur :", err.message);
    }
  }, INTERVALLE_MS);
}
