import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Aurora from "./components/Aurora";
import { useSpotlight } from "./lib/fx";

// Étudiant
import Menu from "./pages/etudiant/Menu";
import MesReservations from "./pages/etudiant/MesReservations";
import Ticket from "./pages/etudiant/Ticket";
import Notifications from "./pages/etudiant/Notifications";

// Agent de contrôle
import Scanner from "./pages/agent/Scanner";

// Gestionnaire des repas
import Plats from "./pages/gestionnaire/Plats";
import MenusAdmin from "./pages/gestionnaire/MenusAdmin";
import Commandes from "./pages/gestionnaire/Commandes";

// Administrateur
import Creneaux from "./pages/administrateur/Creneaux";
import Personnel from "./pages/administrateur/Personnel";
import Statistiques from "./pages/administrateur/Statistiques";

export default function App() {
  useSpotlight();
  return (
    <>
      <Aurora />
      <AppRoutes />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />

      <Route element={<Layout />}>
        {/* Routes partagées par chemin, le contenu dépend du rôle connecté */}
        <Route path="/" element={<RoleHome />} />
        <Route path="/mes-reservations" element={<MesReservations />} />
        <Route path="/ticket/:id" element={<Ticket />} />
        <Route path="/notifications" element={<Notifications />} />

        <Route path="/menu-du-jour" element={<MenusAdmin />} />
        <Route path="/commandes" element={<Commandes />} />

        <Route path="/personnel" element={<Personnel />} />
        <Route path="/statistiques" element={<Statistiques />} />
      </Route>
    </Routes>
  );
}

// La page "/" diffère selon le rôle (Menu, Scanner, Plats, Créneaux)
import { useAuth } from "./context/AuthContext";

function RoleHome() {
  const { user } = useAuth();
  if (!user) return null;
  switch (user.role) {
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
