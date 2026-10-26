import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { API_URL } from "./api/client.js";
import { synchroniserHeure } from "./lib/format.js";

// L'heure du Maroc vient du serveur ; on n'attend pas plus de 2 s pour afficher l'application.
const DELAI_HEURE_MS = 2000;
await Promise.race([synchroniserHeure(API_URL), new Promise((r) => setTimeout(r, DELAI_HEURE_MS))]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
