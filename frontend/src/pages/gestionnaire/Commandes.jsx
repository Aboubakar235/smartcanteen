import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/ui/EmptyState";
import { Badge, Banner, Meter, PageHeader, Section, Segmented, Skeleton } from "../../components/ui";
import { IconBag, IconChair } from "../../components/ui/icons";
import { aujourdhui, dateLongue, heure, plage } from "../../lib/format";

const VUES = [
  { value: "sur-place", label: "Sur place", icon: IconChair },
  { value: "a-emporter", label: "À emporter", icon: IconBag },
];

const STATUTS = ["EN_ATTENTE", "EN_PREPARATION", "PRETE", "RECUPEREE"];
const LABEL = {
  EN_ATTENTE: "En attente",
  EN_PREPARATION: "En préparation",
  PRETE: "Prête",
  RECUPEREE: "Récupérée",
};
const ACTION = {
  EN_PREPARATION: "Démarrer",
  PRETE: "Marquer prête",
  RECUPEREE: "Remise",
};
const TONE = {
  EN_ATTENTE: "",
  EN_PREPARATION: "warn",
  PRETE: "success",
  RECUPEREE: "",
};

const RAFRAICHISSEMENT_MS = 30_000;

export default function Commandes() {
  const [vue, setVue] = useState("sur-place");

  return (
    <>
      <PageHeader title="Commandes" sub="Les repas à préparer pour les étudiants qui ont réservé." />
      <div style={{ marginBottom: 18 }}>
        <Segmented label="Type de commande" value={vue} onChange={setVue} options={VUES} />
      </div>
      {vue === "sur-place" ? <SurPlace /> : <AEmporter />}
    </>
  );
}

// Repas réservés sur place : combien en préparer, par créneau et pour la journée.
function SurPlace() {
  const { token } = useAuth();
  const [date, setDate] = useState(aujourdhui());
  const [creneaux, setCreneaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;
    function charger() {
      api
        .surPlace(date, token)
        .then((r) => actif && (setCreneaux(r.creneaux), setErreur(null)))
        .catch((e) => actif && setErreur(e.message))
        .finally(() => actif && setLoading(false));
    }
    charger();
    const intervalle = setInterval(charger, RAFRAICHISSEMENT_MS);
    return () => {
      actif = false;
      clearInterval(intervalle);
    };
  }, [date, token]);

  // Total de la journée par repas, tous créneaux confondus.
  const parRepas = useMemo(() => {
    const totaux = new Map();
    for (const c of creneaux) {
      for (const r of c.repas) {
        const t = totaux.get(r.id) ?? { nom: r.nom, total: 0, entres: 0 };
        t.total += r.total;
        t.entres += r.entres;
        totaux.set(r.id, t);
      }
    }
    return [...totaux.values()].sort((a, b) => b.total - a.total);
  }, [creneaux]);

  const total = parRepas.reduce((s, r) => s + r.total, 0);
  const entres = parRepas.reduce((s, r) => s + r.entres, 0);

  return (
    <div className="stack-lg">
      <div className="field" style={{ maxWidth: 260 }}>
        <label className="label" htmlFor="date-sur-place">
          Date
        </label>
        <input
          id="date-sur-place"
          className="input"
          type="date"
          value={date}
          onChange={(e) => {
            if (!e.target.value) return;
            setLoading(true);
            setDate(e.target.value);
          }}
        />
      </div>
      <Banner>{erreur}</Banner>

      {loading ? (
        <Skeleton count={3} height={88} />
      ) : total === 0 ? (
        <EmptyState
          icon={IconChair}
          title="Aucune réservation sur place"
          hint={`Personne n'a encore réservé sur place pour le ${dateLongue(date)}.`}
        />
      ) : (
        <>
          <Section title={`À préparer le ${dateLongue(date)}`} count={total}>
            <div className="card list-card">
              {parRepas.map((r) => (
                <div key={r.nom} className="list-row">
                  <div className="grow">
                    <div className="card-title">{r.nom}</div>
                    <div className="meta">
                      <span>{r.entres} déjà entré{r.entres > 1 ? "s" : ""}</span>
                      <span>{r.total - r.entres} attendu{r.total - r.entres > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <span className="numtag">{r.total}</span>
                </div>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              {entres} étudiant{entres > 1 ? "s" : ""} sur {total} déjà entré{entres > 1 ? "s" : ""}. Mise à jour
              automatique toutes les 30 secondes.
            </p>
          </Section>

          <Section title="Par créneau" count={creneaux.length}>
            <div className="stack">
              {creneaux.map((c) => {
                const totalCreneau = c.repas.reduce((s, r) => s + r.total, 0);
                const entresCreneau = c.repas.reduce((s, r) => s + r.entres, 0);
                return (
                  <article key={c.id} className="card card-pad-lg stack">
                    <div className="row-between">
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {plage(c.heureDebut, c.heureFin)}
                      </span>
                      <Badge tone="accent" plain>
                        {totalCreneau} repas
                      </Badge>
                    </div>
                    <Meter value={entresCreneau} max={totalCreneau} seuils={false} />
                    <span className="hint">
                      {entresCreneau} entré{entresCreneau > 1 ? "s" : ""} sur {totalCreneau}
                    </span>
                    <div className="stack" style={{ gap: 6 }}>
                      {c.repas.map((r) => (
                        <div key={r.id} className="row-between">
                          <span>{r.nom}</span>
                          <strong>× {r.total}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// Commandes à emporter : chaque commande avance jusqu'à sa remise (EF-33, EF-34).
function AEmporter() {
  const { token } = useAuth();
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  function recharger() {
    api
      .commandes(null, token)
      .then(setCommandes)
      .catch((e) => setErreur(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(recharger, [token]);

  async function changerStatut(id, statut) {
    setCommandes((prev) => prev.map((c) => (c.id === id ? { ...c, statutCommande: statut } : c)));
    try {
      await api.majStatutCommande(id, statut, token);
    } catch (e) {
      setErreur(e.message);
      recharger();
    }
  }

  const enCours = commandes.filter((c) => c.statutCommande !== "RECUPEREE").length;

  return (
    <>
      <p className="hint" style={{ marginBottom: 12 }}>
        {loading ? "" : `${enCours} commande${enCours > 1 ? "s" : ""} à préparer`}
      </p>
      <Banner>{erreur}</Banner>

      {loading ? (
        <Skeleton count={3} height={96} />
      ) : commandes.length === 0 ? (
        <EmptyState icon={IconBag} title="Aucune commande en cours" hint="Les commandes à emporter apparaîtront ici." />
      ) : (
        <div className="stack">
          {commandes.map((c) => {
            const indexActuel = STATUTS.indexOf(c.statutCommande);
            const suivant = STATUTS[indexActuel + 1];
            return (
              <article key={c.id} className="card">
                <div className="row">
                  <span className={`numtag ${c.statutCommande === "PRETE" ? "live" : ""}`}>{c.numeroPassage}</span>
                  <div className="grow">
                    <div className="card-title">{c.repasNom}</div>
                    <div className="meta">
                      <span className="mono">
                        {heure(c.heureDebut)}
                      </span>
                      <Badge tone={TONE[c.statutCommande]}>{LABEL[c.statutCommande]}</Badge>
                    </div>
                  </div>
                  {suivant && (
                    <button
                      className={`btn btn-sm ${suivant === "RECUPEREE" ? "btn-secondary" : "btn-primary"}`}
                      onClick={() => changerStatut(c.id, suivant)}
                    >
                      {ACTION[suivant]}
                    </button>
                  )}
                </div>
                <div className={`steps ${c.statutCommande === "PRETE" || c.statutCommande === "RECUPEREE" ? "ready" : ""}`} aria-label={`Étape ${indexActuel + 1} sur ${STATUTS.length}`}>
                  {STATUTS.map((s, i) => (
                    <span key={s} className={i <= indexActuel ? "done" : ""} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
