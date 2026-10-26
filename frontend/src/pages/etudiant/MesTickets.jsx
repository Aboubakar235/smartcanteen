import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/ui/EmptyState";
import { Badge, Banner, PageHeader, Section, Skeleton } from "../../components/ui";
import { IconTicket } from "../../components/ui/icons";
import { dateCourte, ETAT_RESERVATION, ETATS_ACTIFS, MODE_LABEL, plage } from "../../lib/format";

function ReservationRow({ r }) {
  const etat = ETAT_RESERVATION[r.etat] ?? { label: r.etat, tone: "" };
  const actif = ETATS_ACTIFS.includes(r.etat);
  return (
    <Link to={`/ticket/${r.id}`} className="list-row row-link">
      <span className={`numtag ${actif ? "live" : ""}`}>{r.numeroPassage}</span>
      <div className="grow">
        <div className="card-title">{r.repasNom}</div>
        <div className="meta">
          <span>{dateCourte(r.date)}</span>
          <span className="mono">{plage(r.heureDebut, r.heureFin)}</span>
          <span>{MODE_LABEL[r.mode] ?? r.mode}</span>
        </div>
      </div>
      <Badge tone={etat.tone}>{etat.label}</Badge>
    </Link>
  );
}

export default function MesTickets() {
  const { token } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api
      .mesReservations(token)
      .then(setReservations)
      .catch((e) => setErreur(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const aVenir = reservations.filter((r) => ETATS_ACTIFS.includes(r.etat));
  const historique = reservations.filter((r) => !ETATS_ACTIFS.includes(r.etat));

  return (
    <>
      <PageHeader title="Mes tickets" />
      <Banner>{erreur}</Banner>

      {loading ? (
        <Skeleton count={3} height={76} />
      ) : reservations.length === 0 ? (
        <EmptyState
          icon={IconTicket}
          title="Aucun ticket pour l'instant"
          hint="Réservez un repas depuis le menu du jour : votre ticket apparaîtra ici."
          action={
            <Link to="/" className="btn btn-primary btn-sm">
              Voir le menu
            </Link>
          }
        />
      ) : (
        <>
          {aVenir.length > 0 && (
            <Section title="À venir" count={aVenir.length}>
              <div className="card list-card">
                {aVenir.map((r) => (
                  <ReservationRow key={r.id} r={r} />
                ))}
              </div>
            </Section>
          )}
          {historique.length > 0 && (
            <Section title="Historique" count={historique.length}>
              <div className="card list-card">
                {historique.map((r) => (
                  <ReservationRow key={r.id} r={r} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
}
