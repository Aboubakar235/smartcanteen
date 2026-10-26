import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { initiales } from "../lib/format";
import { Logo } from "./Logo";
import {
  IconTray,
  IconTicket,
  IconBell,
  IconScan,
  IconBag,
  IconUsers,
  IconChart,
  IconCalendar,
  IconLogOut,
} from "./icons";

const ROLE_LABEL = {
  ETUDIANT: "Étudiant",
  AGENT_CONTROLE: "Agent de contrôle",
  GESTIONNAIRE_REPAS: "Gestionnaire des repas",
  ADMINISTRATEUR: "Administrateur",
};

const NAV_BY_ROLE = {
  ETUDIANT: [
    { to: "/", label: "Menu", icon: IconTray },
    { to: "/mes-reservations", label: "Mes tickets", icon: IconTicket },
    { to: "/notifications", label: "Notifications", icon: IconBell },
  ],
  AGENT_CONTROLE: [{ to: "/", label: "Contrôle", icon: IconScan }],
  GESTIONNAIRE_REPAS: [
    { to: "/", label: "Plats", icon: IconTray },
    { to: "/menu-du-jour", label: "Menus", icon: IconCalendar },
    { to: "/commandes", label: "Commandes", icon: IconBag },
  ],
  ADMINISTRATEUR: [
    { to: "/", label: "Créneaux", icon: IconCalendar },
    { to: "/personnel", label: "Personnel", icon: IconUsers },
    { to: "/statistiques", label: "Statistiques", icon: IconChart },
  ],
};

function NavItems({ nav }) {
  return nav.map((item) => (
    <NavLink key={item.to} to={item.to} end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
      <item.icon width={21} height={21} />
      {item.label}
    </NavLink>
  ));
}

export default function Layout() {
  const { user, loading, logout } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/connexion" replace />;

  const nav = NAV_BY_ROLE[user.role] || [];
  const role = ROLE_LABEL[user.role];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav className="sidebar-nav" aria-label="Navigation principale">
          <NavItems nav={nav} />
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{initiales(user.nom)}</div>
          <div className="who">
            <div className="who-name">{user.nom}</div>
            <div className="who-role">{role}</div>
          </div>
          <button className="icon-btn" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
            <IconLogOut width={18} height={18} />
          </button>
        </div>
      </aside>

      <div>
        <header className="topbar">
          <Logo sub={role} />
          <div className="topbar-actions">
            <button className="icon-btn" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
              <IconLogOut width={19} height={19} />
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {nav.length > 1 && (
        <nav className="bottomnav" aria-label="Navigation principale">
          <NavItems nav={nav} />
        </nav>
      )}
    </div>
  );
}
