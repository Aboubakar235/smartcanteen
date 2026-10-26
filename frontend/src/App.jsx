import { Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useSpotlight } from "./lib/effets";
import Layout from "./components/layout/Layout";
import Aurora from "./components/marque/Aurora";
import Connexion from "./pages/Connexion";

import Menu from "./pages/etudiant/Menu";
import MesTickets from "./pages/etudiant/MesTickets";
import Ticket from "./pages/etudiant/Ticket";
import Notifications from "./pages/etudiant/Notifications";

import Scanner from "./pages/agent/Scanner";

import Plats from "./pages/gestionnaire/Plats";
import Menus from "./pages/gestionnaire/Menus";
import Commandes from "./pages/gestionnaire/Commandes";

import Creneaux from "./pages/administrateur/Creneaux";
import Comptes from "./pages/administrateur/Comptes";
import Statistiques from "./pages/administrateur/Statistiques";

export default function App() {
  useSpotlight();
  return (
    <>
      <Aurora />
      <Routes>
        <Route path="/connexion" element={<Connexion />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Accueil />} />
          <Route path="/mes-reservations" element={<MesTickets />} />
          <Route path="/ticket/:id" element={<Ticket />} />
          <Route path="/notifications" element={<Notifications />} />

          <Route path="/menu-du-jour" element={<Menus />} />
          <Route path="/commandes" element={<Commandes />} />

          <Route path="/comptes" element={<Comptes />} />
          <Route path="/statistiques" element={<Statistiques />} />
        </Route>
      </Routes>
    </>
  );
}

// La page d'accueil « / » dépend du rôle connecté.
function Accueil() {
  const { user } = useAuth();
  switch (user?.role) {
    case "ETUDIANT":
      return <Menu />;
    case "AGENT_CONTROLE":
      return <Scanner />;
    case "GESTIONNAIRE_REPAS":
      return <Plats />;
    case "ADMINISTRATEUR":
      return <Creneaux />;
    default:
      return null;
  }
}
