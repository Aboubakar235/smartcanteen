import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { AppError } from "./lib/asyncHandler.js";
import { aujourdhuiMaroc, decalageMarocMinutes, FUSEAU } from "./lib/heureMaroc.js";

import authRoutes from "./routes/auth.routes.js";
import platsRoutes from "./routes/plats.routes.js";
import repasRoutes from "./routes/repas.routes.js";
import menusRoutes from "./routes/menus.routes.js";
import creneauxRoutes from "./routes/creneaux.routes.js";
import reservationsRoutes from "./routes/reservations.routes.js";
import ticketsRoutes from "./routes/tickets.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import commandesRoutes from "./routes/commandes.routes.js";
import adminRoutes from "./routes/admin.routes.js";

export const app = express();

// CORS_ORIGIN : adresses autorisées, séparées par des virgules (ex. l'adresse
// Vercel du front). Sans valeur, toutes les origines sont acceptées (développement).
const originesAutorisees = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(originesAutorisees?.length ? { origin: originesAutorisees } : undefined));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// TECH-13 : heure de référence de la cantine. Les écrans l'utilisent plutôt que
// la base de fuseaux de chaque appareil, qui peut être périmée.
app.get("/api/heure", (req, res) =>
  res.json({
    fuseau: FUSEAU,
    date: aujourdhuiMaroc(),
    decalageMinutes: decalageMarocMinutes(),
    maintenant: new Date().toISOString(),
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/plats", platsRoutes);
app.use("/api/repas", repasRoutes);
app.use("/api/menus", menusRoutes);
app.use("/api/creneaux", creneauxRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/commandes", commandesRoutes);
app.use("/api/admin", adminRoutes);

// ENF-21 : messages d'erreur clairs, avec l'action attendue quand c'est pertinent.
app.use((req, res) => {
  res.status(404).json({ error: "Ressource introuvable." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Données invalides.",
      details: err.issues.map((i) => ({ champ: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...err.details });
  }
  // ENF-16 : journaliser les erreurs applicatives pour faciliter le diagnostic.
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});
