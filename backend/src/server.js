import "dotenv/config";
import { app } from "./app.js";
import { demarrerPlanificateur } from "./services/scheduler.js";

// En production, un secret JWT faible permettrait de forger des sessions et des QR codes.
const SECRET_PAR_DEFAUT = "change-me-in-production";
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET === SECRET_PAR_DEFAUT)) {
  console.error("JWT_SECRET doit être défini avec une valeur secrète en production.");
  process.exit(1);
}

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Smart Canteen API en écoute sur http://localhost:${port}`);
  demarrerPlanificateur();
});
