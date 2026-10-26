import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/ui/EmptyState";
import { Badge, Banner, PageHeader, Skeleton } from "../../components/ui";
import { IconBag } from "../../components/ui/icons";
import { heure } from "../../lib/format";

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

export default function Commandes() {
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
      <PageHeader
        title="Commandes à emporter"
        sub={loading ? null : `${enCours} commande${enCours > 1 ? "s" : ""} à préparer`}
      />
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
