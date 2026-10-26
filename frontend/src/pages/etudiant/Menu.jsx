import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../api/client";
import EmptyState from "../../components/EmptyState";
import { Banner, Segmented, Sheet, Skeleton } from "../../components/ui";
import { IconBag, IconChair, IconChevronRight, IconTray } from "../../components/icons";
import { aujourdhui, dateLongue, ETATS_ACTIFS, plage, prenom, SERVICE_LABEL } from "../../lib/format";

const SEUIL_STOCK_BAS = 10;

const MODES = [
  { value: "SUR_PLACE", label: "Sur place", icon: IconChair },
  { value: "A_EMPORTER", label: "À emporter", icon: IconBag },
];

function Stock({ restant }) {
  if (restant <= 0) return <span className="stock out">Épuisé</span>;
  if (restant <= SEUIL_STOCK_BAS) return <span className="stock low">Plus que {restant} portions</span>;
  return <span className="stock">{restant} portions disponibles</span>;
}

export default function Menu() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const date = aujourdhui();

  const [menus, setMenus] = useState([]);
  const [creneaux, setCreneaux] = useState([]);
  const [ticketActif, setTicketActif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [choix, setChoix] = useState(null); // { repasId, repasNom, service }
  const [creneauId, setCreneauId] = useState("");
  const [mode, setMode] = useState("SUR_PLACE");
  const [envoi, setEnvoi] = useState(false);
  const [erreurReservation, setErreurReservation] = useState(null);
  const [alternatives, setAlternatives] = useState(null);

  useEffect(() => {
    Promise.all([api.getMenu(date, token), api.getCreneaux(date, token), api.mesReservations(token)])
      .then(([m, c, r]) => {
        setMenus(m);
        setCreneaux(c);
        setTicketActif(r.find((x) => x.date === date && ETATS_ACTIFS.includes(x.etat)) ?? null);
      })
      .catch((e) => setErreur(e.message))
      .finally(() => setLoading(false));
  }, [token, date]);

  function ouvrirReservation(repas, menu) {
    setChoix({ repasId: repas.id, repasNom: repas.nom, service: menu.service, creneauIds: menu.creneauIds ?? [] });
    setCreneauId("");
    setMode("SUR_PLACE");
    setAlternatives(null);
    setErreurReservation(null);
  }

  const fermer = useCallback(() => setChoix(null), []);

  async function confirmerReservation() {
    setEnvoi(true);
    setErreurReservation(null);
    setAlternatives(null);
    try {
      const res = await api.reserver({ creneauId, repasId: choix.repasId, mode }, token);
      navigate(`/ticket/${res.id}`, { state: { nouveau: true } });
    } catch (e) {
      if (e instanceof ApiError && e.details?.alternatives?.length) {
        setAlternatives(e.details.alternatives);
      }
      setErreurReservation(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const placesLibres = creneaux.reduce((s, c) => s + c.capaciteRestante, 0);
  const creneauxOuverts = creneaux.filter((c) => c.etat !== "complet").length;
  const nbRepas = menus.reduce((s, m) => s + m.repas.length, 0);

  // Le gestionnaire choisit les créneaux de chaque menu : on ne propose que ceux-là.
  const creneauxDuChoix = choix ? creneaux.filter((c) => choix.creneauIds.includes(c.id)) : [];
  const creneauChoisi =
    creneauxDuChoix.find((c) => c.id === creneauId) ?? alternatives?.find((a) => a.id === creneauId);

  return (
    <>
      <section className="hero" aria-label="Aujourd'hui à la cantine">
        <span className="hero-beam" aria-hidden="true" />
        <p className="page-eyebrow">{dateLongue()}</p>
        <h1>
          <span className="hero-grad">{user?.nom ? `Bonjour ${prenom(user.nom)}` : "Menu du jour"}</span>
        </h1>
        <p className="page-sub">
          {ticketActif ? "Votre passage est réservé pour aujourd'hui." : "Que mangez-vous aujourd'hui ?"}
        </p>
        {!loading && (
          <dl className="hero-stats">
            <div>
              <dt>Places libres</dt>
              <dd className={placesLibres > 0 ? "live" : ""}>{placesLibres}</dd>
            </div>
            <div>
              <dt>Créneaux ouverts</dt>
              <dd>{creneauxOuverts}</dd>
            </div>
            <div>
              <dt>Repas au menu</dt>
              <dd>{nbRepas}</dd>
            </div>
          </dl>
        )}
      </section>

      {ticketActif && (
        <Link
          to={`/ticket/${ticketActif.id}`}
          className="stub"
          aria-label={`Ouvrir le ticket ${ticketActif.numeroPassage}`}
        >
          <span className="stub-num">{ticketActif.numeroPassage}</span>
          <span className="stub-body">
            <span className="v">{plage(ticketActif.heureDebut, ticketActif.heureFin)}</span>
            <span className="k">{ticketActif.repasNom}</span>
          </span>
          <span className="stub-go">
            <span className="stub-go-text">Voir le ticket</span>
            <IconChevronRight width={20} height={20} />
          </span>
        </Link>
      )}

      <Banner>{erreur}</Banner>

      {loading ? (
        <Skeleton count={2} height={180} />
      ) : menus.length === 0 ? (
        <EmptyState
          icon={IconTray}
          title="Le menu n'est pas encore publié"
          hint="Le gestionnaire publie le menu du jour avant chaque service. Revenez un peu plus tard."
        />
      ) : (
        <div className="stack-lg">
          {menus.map((m) => (
            <section key={m.id} className="board" aria-labelledby={`service-${m.id}`}>
              <header className="board-head">
                <h2 id={`service-${m.id}`}>{SERVICE_LABEL[m.service] ?? m.service}</h2>
                <span className="count">{m.repas.length} repas au choix</span>
              </header>
              {m.repas.map((r) => {
                const epuise = r.quantiteRestante <= 0;
                return (
                  <article key={r.id} className="dish">
                    <div className="dish-line">
                      <h3 className="dish-name">{r.nom}</h3>
                      <span className="dish-leader" aria-hidden="true" />
                      {r.prixIndicatif > 0 && (
                        <span className="dish-price">
                          {r.prixIndicatif}
                          <small>MAD</small>
                        </span>
                      )}
                    </div>
                    <div className="dish-foot">
                      <Stock restant={r.quantiteRestante} />
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={epuise}
                        onClick={() => ouvrirReservation(r, m)}
                        aria-label={`Réserver ${r.nom}`}
                      >
                        Réserver
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {choix && (
        <Sheet
          title={choix.repasNom}
          sub={`${SERVICE_LABEL[choix.service] ?? ""}, ${dateLongue()}`}
          onClose={fermer}
          footer={
            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={!creneauId || envoi}
              onClick={confirmerReservation}
            >
              {envoi
                ? "Réservation…"
                : creneauChoisi
                  ? `Réserver pour ${plage(creneauChoisi.heureDebut, creneauChoisi.heureFin)}`
                  : "Choisissez un créneau"}
            </button>
          }
        >
          <Banner>{erreurReservation}</Banner>

          <div className="field">
            <span className="label" id="label-creneau">
              À quelle heure passez-vous ?
            </span>
            <div className="slots" role="radiogroup" aria-labelledby="label-creneau">
              {creneauxDuChoix.map((c) => {
                const complet = c.etat === "complet";
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    className="slot"
                    aria-checked={creneauId === c.id}
                    disabled={complet}
                    onClick={() => setCreneauId(c.id)}
                  >
                    <span className="slot-time">{plage(c.heureDebut, c.heureFin)}</span>
                    <span className={`slot-places ${c.etat === "presque complet" ? "warn" : ""}`}>
                      {complet ? "Complet" : `${c.capaciteRestante} places`}
                    </span>
                  </button>
                );
              })}
            </div>
            {creneauxDuChoix.length === 0 && <p className="hint">Aucun créneau n'est prévu pour ce repas.</p>}
          </div>

          {alternatives && (
            <div className="field">
              <span className="label">Créneaux encore libres</span>
              <div className="chips">
                {alternatives.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="chip mono"
                    aria-pressed={creneauId === a.id}
                    onClick={() => setCreneauId(a.id)}
                  >
                    {plage(a.heureDebut, a.heureFin)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <span className="label">Où mangez-vous ?</span>
            <Segmented label="Mode de consommation" value={mode} onChange={setMode} options={MODES} />
          </div>
        </Sheet>
      )}
    </>
  );
}
