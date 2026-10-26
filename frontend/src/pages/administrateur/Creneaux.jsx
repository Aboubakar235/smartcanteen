import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/EmptyState";
import { Badge, Banner, Confirmation, Meter, PageHeader, Section, Skeleton } from "../../components/ui";
import { IconCalendar, IconPlus, IconTrash } from "../../components/icons";
import { aujourdhui, dateLongue, ETAT_CRENEAU, instantMaroc, plage } from "../../lib/format";

export default function Creneaux() {
  const { token } = useAuth();
  const date = aujourdhui();
  const [creneaux, setCreneaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [heureDebut, setHeureDebut] = useState("12:00");
  const [heureFin, setHeureFin] = useState("12:30");
  const [capacite, setCapacite] = useState(60);
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null); // créneau

  const fermerSuppression = useCallback(() => setASupprimer(null), []);

  function recharger() {
    api
      .getCreneaux(date, token)
      .then(setCreneaux)
      .catch((e) => setErreur(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(recharger, [token]);

  async function creer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.creerCreneau(
        {
          date,
          heureDebut: instantMaroc(date, heureDebut),
          heureFin: instantMaroc(date, heureFin),
          capaciteMax: Number(capacite),
        },
        token
      );
      recharger();
    } catch (e2) {
      setErreur(e2.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer() {
    await api.supprimerCreneau(aSupprimer.id, token);
    setCreneaux((prev) => prev.filter((c) => c.id !== aSupprimer.id));
  }

  const totalPlaces = creneaux.reduce((s, c) => s + c.capaciteMax, 0);
  const occupees = creneaux.reduce((s, c) => s + (c.capaciteMax - c.capaciteRestante), 0);

  return (
    <>
      <PageHeader
        eyebrow={dateLongue()}
        title="Créneaux du jour"
        sub={loading ? null : `${occupees} / ${totalPlaces} places réservées sur ${creneaux.length} créneau(x)`}
      />

      <form className="card card-pad-lg stack-lg" onSubmit={creer}>
        <h2>Nouveau créneau</h2>
        <Banner>{erreur}</Banner>
        <div className="form-grid cols-3">
          <div className="field">
            <label className="label" htmlFor="hd">
              Début
            </label>
            <input id="hd" className="input" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="hf">
              Fin
            </label>
            <input id="hf" className="input" type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="cap">
              Capacité
            </label>
            <input
              id="cap"
              className="input"
              type="number"
              min="1"
              value={capacite}
              onChange={(e) => setCapacite(e.target.value)}
            />
          </div>
        </div>
        <div>
          <button className="btn btn-primary" disabled={envoi}>
            <IconPlus width={16} height={16} />
            {envoi ? "Création…" : "Créer le créneau"}
          </button>
        </div>
      </form>

      <Section title="Planning" count={loading ? null : creneaux.length}>
        {loading ? (
          <Skeleton count={3} height={72} />
        ) : creneaux.length === 0 ? (
          <EmptyState icon={IconCalendar} title="Aucun créneau" hint="Créez le premier créneau de la journée ci-dessus." />
        ) : (
          <div className="card list-card">
            {creneaux.map((c) => {
              const etat = ETAT_CRENEAU[c.etat] ?? { label: c.etat, tone: "" };
              const pris = c.capaciteMax - c.capaciteRestante;
              return (
                <div key={c.id} className="list-row">
                  <div className="grow stack" style={{ gap: 8 }}>
                    <div className="row-between">
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {plage(c.heureDebut, c.heureFin)}
                      </span>
                      <div className="row" style={{ gap: 6 }}>
                        <Badge tone={etat.tone}>{etat.label}</Badge>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Supprimer le créneau ${plage(c.heureDebut, c.heureFin)}`}
                          onClick={() => setASupprimer(c)}
                        >
                          <IconTrash width={16} height={16} />
                        </button>
                      </div>
                    </div>
                    <Meter value={pris} max={c.capaciteMax} />
                    <span className="hint">
                      {pris} / {c.capaciteMax} places réservées
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {aSupprimer && (
        <Confirmation
          title="Supprimer ce créneau ?"
          message={`Le créneau ${plage(aSupprimer.heureDebut, aSupprimer.heureFin)} sera retiré du planning et des menus qui l'utilisent. Un créneau déjà réservé ne peut pas être supprimé.`}
          onConfirm={supprimer}
          onClose={fermerSuppression}
        />
      )}
    </>
  );
}
