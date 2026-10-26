import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { Banner, Skeleton } from "../../components/ui";
import { ZelligePattern } from "../../components/marque/Logo";
import { IconArrowLeft, IconTray } from "../../components/ui/icons";
import { useInclinaison } from "../../lib/effets";
import { dateCourte, ETAT_RESERVATION, ETATS_ACTIFS, MODE_LABEL, plage } from "../../lib/format";

const PERSONNES_AFFICHEES = 8;

// La file vue de côté : le comptoir, les personnes devant vous, puis vous.
function FileAttente({ position, tempsAttenteEstimeSec }) {
  const devant = Math.max(0, position - 1);
  const visibles = Math.min(devant, PERSONNES_AFFICHEES);
  const minutes = Math.ceil(tempsAttenteEstimeSec / 60);

  return (
    <section className="queue" aria-labelledby="titre-file">
      <div className="queue-head">
        <h2 id="titre-file" className="queue-title">
          {devant === 0 ? "C'est bientôt à vous" : `${devant} ${devant > 1 ? "personnes" : "personne"} devant vous`}
        </h2>
        {devant > 0 && <span className="queue-wait">≈ {minutes} min</span>}
      </div>
      <div className="queue-line" aria-hidden="true">
        <span className="queue-counter" title="Comptoir">
          <IconTray width={16} height={16} />
        </span>
        {Array.from({ length: visibles }, (_, i) => (
          <span key={i} className="queue-person" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
        {devant > visibles && <span className="queue-more">+{devant - visibles}</span>}
        <span className="queue-me">Vous</span>
      </div>
      <p className="queue-caption">Mise à jour automatique toutes les 15 secondes.</p>
    </section>
  );
}

export default function Ticket() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nouveau = Boolean(location.state?.nouveau);

  const [reservation, setReservation] = useState(null);
  const [file, setFile] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [annulation, setAnnulation] = useState(false);
  const [ticketRef, tilt] = useInclinaison();

  const charger = useCallback(() => {
    api.getReservation(id, token).then(setReservation).catch((e) => setErreur(e.message));
    api
      .suiviFile(id, token)
      .then(setFile)
      .catch(() => setFile(null));
  }, [id, token]);

  useEffect(() => {
    charger();
    const interval = setInterval(charger, 15000); // EF-21/22 : suivi de file en direct
    return () => clearInterval(interval);
  }, [charger]);

  async function annuler() {
    if (!confirm("Annuler cette réservation ? Votre place sera libérée.")) return;
    setAnnulation(true);
    try {
      await api.annulerReservation(id, token);
      navigate("/mes-reservations");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setAnnulation(false);
    }
  }

  const retour = (
    <Link to="/mes-reservations" className="back-link">
      <IconArrowLeft width={16} height={16} />
      Mes tickets
    </Link>
  );

  if (!reservation)
    return (
      <>
        {retour}
        {erreur ? <Banner>{erreur}</Banner> : <Skeleton height={520} />}
      </>
    );

  const etat = ETAT_RESERVATION[reservation.etat] ?? { label: reservation.etat };
  const actif = ETATS_ACTIFS.includes(reservation.etat);
  const peutAnnuler = ["EN_ATTENTE", "CONFIRMEE"].includes(reservation.etat);
  const afficherQr = actif && reservation.qrCodeJeton;

  return (
    <div className="stack-lg">
      <div>
        {retour}
        <Banner>{erreur}</Banner>
      </div>

      <div className="ticket-stage">
        <article
          ref={ticketRef}
          className={`ticket ${actif ? "" : "inactive"} ${nouveau ? "print" : ""}`}
          {...(actif ? tilt : {})}
        >
          <div className="ticket-top">
            {actif && <ZelligePattern id="zellige-ticket" opacity={0.13} color="#1c1404" />}
            <div className="ticket-row">
              <span className="ticket-kicker">{nouveau ? "Réservation confirmée" : "Votre numéro"}</span>
              <span className="ticket-state">{etat.label}</span>
            </div>
            <p className="ticket-numero" aria-label={`Numéro de passage ${reservation.numeroPassage}`}>
              {reservation.numeroPassage}
            </p>
            <p className="ticket-meal">{reservation.repasNom}</p>
          </div>

          <div className="ticket-cut" aria-hidden="true" />

          <div className="ticket-bottom">
            {afficherQr ? (
              <>
                <div className="ticket-qr">
                  <div className="qr-frame">
                    <QRCodeSVG value={reservation.qrCodeJeton} size={176} fgColor="#031110" />
                  </div>
                </div>
                <p className="ticket-hint">Montrez ce code à l'agent à l'entrée de la cantine.</p>
              </>
            ) : (
              <p className="ticket-hint">Ce ticket n'est plus valable.</p>
            )}

            <dl className="ticket-meta">
              <div>
                <dt>Date</dt>
                <dd>{dateCourte(reservation.date)}</dd>
              </div>
              <div>
                <dt>Créneau</dt>
                <dd>{plage(reservation.heureDebut, reservation.heureFin)}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{MODE_LABEL[reservation.mode] ?? reservation.mode}</dd>
              </div>
            </dl>
          </div>
        </article>
      </div>

      {file && actif && <FileAttente {...file} />}

      {peutAnnuler && (
        <div className="queue">
          <button className="btn btn-danger btn-block" onClick={annuler} disabled={annulation}>
            {annulation ? "Annulation…" : "Annuler la réservation"}
          </button>
        </div>
      )}
    </div>
  );
}
