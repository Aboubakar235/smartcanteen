import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/EmptyState";
import { Badge, Banner, PageHeader, Section, Skeleton } from "../../components/ui";
import { IconPlus, IconUsers } from "../../components/icons";
import { initiales } from "../../lib/format";

const ROLE_LABEL = {
  AGENT_CONTROLE: "Agent de contrôle",
  GESTIONNAIRE_REPAS: "Gestionnaire des repas",
  ADMINISTRATEUR: "Administrateur",
};

export default function Personnel() {
  const { token } = useAuth();
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState("AGENT_CONTROLE");
  const [envoi, setEnvoi] = useState(false);

  function recharger() {
    api
      .getPersonnel(token)
      .then(setPersonnel)
      .catch((e) => setErreur(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(recharger, [token]);

  async function creerCompte(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.creerPersonnel({ nom, emailInstitutionnel: email, motDePasse, role }, token);
      setNom("");
      setEmail("");
      setMotDePasse("");
      recharger();
    } catch (e2) {
      setErreur(e2.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function basculerStatut(p) {
    const nouveau = p.statut === "actif" ? "suspendu" : "actif";
    setPersonnel((prev) => prev.map((x) => (x.id === p.id ? { ...x, statut: nouveau } : x)));
    try {
      await api.majStatutPersonnel(p.id, nouveau, token);
    } catch (e) {
      setErreur(e.message);
      recharger();
    }
  }

  return (
    <>
      <PageHeader title="Personnel" sub="Comptes des agents de contrôle, gestionnaires et administrateurs." />

      <form className="card card-pad-lg stack-lg" onSubmit={creerCompte}>
        <h2>Nouveau compte</h2>
        <Banner>{erreur}</Banner>
        <div className="form-grid cols-2">
          <div className="field">
            <label className="label" htmlFor="nom">
              Nom complet
            </label>
            <input id="nom" className="input" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="email">
              Email institutionnel
            </label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="mdp">
              Mot de passe provisoire
            </label>
            <input
              id="mdp"
              className="input"
              type="password"
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              minLength={6}
              required
            />
            <span className="hint">6 caractères minimum.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="role">
              Rôle
            </label>
            <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <button className="btn btn-primary" disabled={envoi}>
            <IconPlus width={16} height={16} />
            {envoi ? "Création…" : "Créer le compte"}
          </button>
        </div>
      </form>

      <Section title="Équipe" count={loading ? null : personnel.length}>
        {loading ? (
          <Skeleton count={3} height={64} />
        ) : personnel.length === 0 ? (
          <EmptyState icon={IconUsers} title="Aucun compte" hint="Créez le premier compte du personnel ci-dessus." />
        ) : (
          <div className="card list-card">
            {personnel.map((p) => {
              const actif = p.statut === "actif";
              return (
                <div key={p.id} className="list-row">
                  <div className="avatar">{initiales(p.nom)}</div>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="card-title">{p.nom}</span>
                      {!actif && <Badge tone="danger">Suspendu</Badge>}
                    </div>
                    <div className="meta">
                      <span>{ROLE_LABEL[p.role] ?? p.role}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{p.email_institutionnel}</span>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => basculerStatut(p)}>
                    {actif ? "Suspendre" : "Réactiver"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
