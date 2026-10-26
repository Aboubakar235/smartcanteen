import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/ui/EmptyState";
import { Badge, Banner, PageHeader, Section, Sheet, Skeleton } from "../../components/ui";
import { IconPlus, IconUsers } from "../../components/ui/icons";
import { initiales } from "../../lib/format";

const ROLE_LABEL = {
  ETUDIANT: "Étudiant",
  AGENT_CONTROLE: "Agent de contrôle",
  GESTIONNAIRE_REPAS: "Gestionnaire des repas",
  ADMINISTRATEUR: "Administrateur",
};

const FILTRES = [
  { valeur: "TOUS", libelle: "Tous" },
  { valeur: "ETUDIANT", libelle: "Étudiants" },
  { valeur: "AGENT_CONTROLE", libelle: "Agents" },
  { valeur: "GESTIONNAIRE_REPAS", libelle: "Gestionnaires" },
  { valeur: "ADMINISTRATEUR", libelle: "Administrateurs" },
];

const MOT_DE_PASSE_MIN = 8;
// Sans caractères ambigus (0/O, 1/l/I) : le mot de passe se dicte ou se recopie sans erreur.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function motDePasseProvisoire(longueur = 10) {
  const octets = crypto.getRandomValues(new Uint32Array(longueur));
  return Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join("");
}

// Champ du mot de passe provisoire : visible, pour que l'administrateur puisse le transmettre.
function ChampMotDePasse({ id, valeur, onChange }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        Mot de passe provisoire
      </label>
      <div className="row" style={{ gap: 8 }}>
        <input
          id={id}
          className="input mono"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          minLength={MOT_DE_PASSE_MIN}
          required
        />
        <button type="button" className="btn btn-secondary" onClick={() => onChange(motDePasseProvisoire())}>
          Générer
        </button>
      </div>
      <span className="hint">
        {MOT_DE_PASSE_MIN} caractères minimum. À transmettre à la personne : elle le changera depuis son profil.
      </span>
    </div>
  );
}

export default function Comptes() {
  const { token, user } = useAuth();
  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState(() => motDePasseProvisoire());
  const [role, setRole] = useState("ETUDIANT");
  const [envoi, setEnvoi] = useState(false);
  const [retourCreation, setRetourCreation] = useState(null); // { type, message }

  const [filtre, setFiltre] = useState("TOUS");
  const [recherche, setRecherche] = useState("");

  const [aReinitialiser, setAReinitialiser] = useState(null);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [retourReinit, setRetourReinit] = useState(null);
  const [envoiReinit, setEnvoiReinit] = useState(false);

  function recharger() {
    api
      .getComptes(token)
      .then(setComptes)
      .catch((e) => setErreur(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(recharger, [token]);

  async function creerCompte(e) {
    e.preventDefault();
    setEnvoi(true);
    setRetourCreation(null);
    try {
      await api.creerCompte({ nom, emailInstitutionnel: email, motDePasse, role }, token);
      setRetourCreation({
        type: "success",
        message: `Compte ${ROLE_LABEL[role].toLowerCase()} créé pour ${nom}. Mot de passe provisoire à lui transmettre : ${motDePasse}`,
      });
      setNom("");
      setEmail("");
      setMotDePasse(motDePasseProvisoire());
      recharger();
    } catch (e2) {
      setRetourCreation({ type: "error", message: e2.message });
    } finally {
      setEnvoi(false);
    }
  }

  async function basculerStatut(c) {
    const nouveau = c.statut === "actif" ? "suspendu" : "actif";
    setComptes((prev) => prev.map((x) => (x.id === c.id ? { ...x, statut: nouveau } : x)));
    try {
      await api.majStatutCompte(c.id, nouveau, token);
    } catch (e) {
      setErreur(e.message);
      recharger();
    }
  }

  function ouvrirReinitialisation(c) {
    setAReinitialiser(c);
    setNouveauMotDePasse(motDePasseProvisoire());
    setRetourReinit(null);
  }

  const fermerReinitialisation = useCallback(() => setAReinitialiser(null), []);

  async function reinitialiser(e) {
    e.preventDefault();
    setEnvoiReinit(true);
    setRetourReinit(null);
    try {
      await api.reinitialiserMotDePasse(aReinitialiser.id, nouveauMotDePasse, token);
      setRetourReinit({
        type: "success",
        message: `Nouveau mot de passe provisoire de ${aReinitialiser.nom} : ${nouveauMotDePasse}`,
      });
    } catch (e2) {
      setRetourReinit({ type: "error", message: e2.message });
    } finally {
      setEnvoiReinit(false);
    }
  }

  const nombreParRole = useMemo(() => {
    const n = { TOUS: comptes.length };
    for (const c of comptes) n[c.role] = (n[c.role] ?? 0) + 1;
    return n;
  }, [comptes]);

  const comptesAffiches = useMemo(() => {
    const texte = recherche.trim().toLowerCase();
    return comptes.filter(
      (c) =>
        (filtre === "TOUS" || c.role === filtre) &&
        (!texte || c.nom.toLowerCase().includes(texte) || c.email_institutionnel.toLowerCase().includes(texte))
    );
  }, [comptes, filtre, recherche]);

  return (
    <>
      <PageHeader title="Comptes" sub="Créez les comptes des étudiants et du personnel, avec un mot de passe provisoire." />

      <form className="card card-pad-lg stack-lg" onSubmit={creerCompte}>
        <h2>Nouveau compte</h2>
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
              placeholder="prenom.nom@um5.ac.ma"
              required
            />
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
          <ChampMotDePasse id="mdp" valeur={motDePasse} onChange={setMotDePasse} />
        </div>
        <div className="stack">
          <div>
            <button className="btn btn-primary" disabled={envoi}>
              <IconPlus width={16} height={16} />
              {envoi ? "Création…" : "Créer le compte"}
            </button>
          </div>
          {retourCreation && <Banner type={retourCreation.type}>{retourCreation.message}</Banner>}
        </div>
      </form>

      <Section title="Tous les comptes" count={loading ? null : comptes.length}>
        <Banner>{erreur}</Banner>
        <div className="stack" style={{ marginBottom: 14 }}>
          <div className="chips" role="group" aria-label="Filtrer par rôle">
            {FILTRES.map((f) => (
              <button
                key={f.valeur}
                type="button"
                className="chip"
                aria-pressed={filtre === f.valeur}
                onClick={() => setFiltre(f.valeur)}
              >
                {f.libelle} · {nombreParRole[f.valeur] ?? 0}
              </button>
            ))}
          </div>
          <input
            className="input"
            type="search"
            aria-label="Rechercher un compte"
            placeholder="Rechercher par nom ou email"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {loading ? (
          <Skeleton count={3} height={64} />
        ) : comptesAffiches.length === 0 ? (
          <EmptyState
            icon={IconUsers}
            title="Aucun compte"
            hint={comptes.length ? "Aucun compte ne correspond à ce filtre." : "Créez le premier compte ci-dessus."}
          />
        ) : (
          <div className="card list-card">
            {comptesAffiches.map((c) => {
              const actif = c.statut === "actif";
              const moi = c.id === user?.id;
              return (
                <div key={c.id} className="list-row">
                  <div className="avatar">{initiales(c.nom)}</div>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="card-title">{c.nom}</span>
                      {moi && <Badge tone="accent">Vous</Badge>}
                      {!actif && <Badge tone="danger">Suspendu</Badge>}
                    </div>
                    <div className="meta">
                      <span>{ROLE_LABEL[c.role] ?? c.role}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{c.email_institutionnel}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => ouvrirReinitialisation(c)}>
                      Mot de passe
                    </button>
                    {!moi && (
                      <button className="btn btn-secondary btn-sm" onClick={() => basculerStatut(c)}>
                        {actif ? "Suspendre" : "Réactiver"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {aReinitialiser && (
        <Sheet
          title="Nouveau mot de passe"
          sub={`${aReinitialiser.nom} · ${ROLE_LABEL[aReinitialiser.role]}`}
          onClose={fermerReinitialisation}
        >
          <form className="stack-lg" onSubmit={reinitialiser}>
            <ChampMotDePasse id="mdp-reinit" valeur={nouveauMotDePasse} onChange={setNouveauMotDePasse} />
            <button className="btn btn-primary btn-block" disabled={envoiReinit}>
              {envoiReinit ? "Enregistrement…" : "Remplacer le mot de passe"}
            </button>
            {retourReinit && <Banner type={retourReinit.type}>{retourReinit.message}</Banner>}
          </form>
        </Sheet>
      )}
    </>
  );
}
