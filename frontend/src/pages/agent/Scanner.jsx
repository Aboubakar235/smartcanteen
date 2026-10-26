import { useCallback, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import CameraScanner from "./CameraScanner";
import { Badge, PageHeader, Segmented } from "../../components/ui";
import { IconCheck, IconCross, IconScan, IconTicket } from "../../components/ui/icons";
import { heure } from "../../lib/format";

const VALIDE_VERDICTS = new Set(["valide"]);
const HISTORIQUE_MAX = 6;
// Le temps de lire le verdict avant que la caméra ne reprenne la lecture
const PAUSE_APRES_SCAN_MS = 2500;

const MODES = [
  { value: "camera", label: "Caméra", icon: IconScan },
  { value: "manuel", label: "Saisie manuelle", icon: IconTicket },
];

function cameraDisponible() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

function Verdict({ resultat }) {
  const valide = VALIDE_VERDICTS.has(resultat.verdict);
  return (
    <div key={resultat.cle} className={`verdict ${valide ? "ok" : "ko"}`} role="status">
      <div className="verdict-icon">
        {valide ? <IconCheck width={44} height={44} /> : <IconCross width={44} height={44} />}
      </div>
      <p className="verdict-title">{valide ? "Accès autorisé" : "Accès refusé"}</p>
      {(resultat.numeroPassage ?? resultat.saisi) && (
        <p className="code" style={{ fontWeight: 600 }}>
          N° {resultat.numeroPassage ?? resultat.saisi}
        </p>
      )}
      {resultat.message && <p className="verdict-msg">{resultat.message}</p>}
    </div>
  );
}

export default function Scanner() {
  const { token } = useAuth();
  const inputRef = useRef(null);
  const [mode, setMode] = useState(cameraDisponible() ? "camera" : "manuel");
  const [numeroPassage, setNumeroPassage] = useState("");
  const [resultat, setResultat] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [cameraEnPause, setCameraEnPause] = useState(false);

  // Vérifie un ticket côté serveur (EF-29, EF-30) et garde la trace du contrôle.
  const verifier = useCallback(
    async (requete, saisi) => {
      setEnvoi(true);
      let data;
      try {
        data = await api.scanTicket(requete, token);
      } catch (e) {
        data = { verdict: "erreur", message: e.message };
      }
      const entree = { ...data, saisi, heure: new Date(), cle: Date.now() };
      setResultat(entree);
      setHistorique((prev) => [entree, ...prev].slice(0, HISTORIQUE_MAX));
      setEnvoi(false);
    },
    [token]
  );

  const onCode = useCallback(
    async (jeton) => {
      setCameraEnPause(true);
      await verifier({ token: jeton }, null);
      setTimeout(() => setCameraEnPause(false), PAUSE_APRES_SCAN_MS);
    },
    [verifier]
  );

  async function soumettre(e) {
    e.preventDefault();
    const numero = numeroPassage;
    await verifier({ numeroPassage: numero }, numero);
    setNumeroPassage("");
    inputRef.current?.focus();
  }

  return (
    <>
      <PageHeader title="Contrôle d'accès" sub="Scannez le QR code du ticket présenté par l'étudiant." />

      <div className="stack-lg">
        <Segmented label="Mode de contrôle" value={mode} onChange={setMode} options={MODES} />

        {mode === "camera" ? (
          <>
            {resultat && <Verdict resultat={resultat} />}
            <CameraScanner onCode={onCode} enPause={cameraEnPause} />
            <p className="hint">
              Si le QR code ne passe pas (écran abîmé, luminosité), utilisez la saisie manuelle du numéro de passage.
            </p>
          </>
        ) : (
          <>
            <form className="card card-pad-lg stack-lg" onSubmit={soumettre}>
              <div className="field">
                <label className="label" htmlFor="numero">
                  Numéro de passage
                </label>
                <input
                  id="numero"
                  ref={inputRef}
                  className="input input-xl"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={numeroPassage}
                  onChange={(e) => setNumeroPassage(e.target.value.toUpperCase())}
                  placeholder="A001"
                />
              </div>
              <button className="btn btn-primary btn-lg btn-block" disabled={!numeroPassage || envoi}>
                {envoi ? "Vérification…" : "Valider le ticket"}
              </button>
            </form>
            {resultat && <Verdict resultat={resultat} />}
          </>
        )}

        {historique.length > 1 && (
          <section className="stack">
            <h2>Derniers contrôles</h2>
            <div className="card list-card">
              {historique.slice(1).map((h) => {
                const ok = VALIDE_VERDICTS.has(h.verdict);
                return (
                  <div key={h.cle} className="list-row">
                    <span className="code grow" style={{ fontWeight: 600 }}>
                      {h.numeroPassage ?? h.saisi ?? "QR code"}
                    </span>
                    <span className="hint mono">
                      {heure(h.heure)}
                    </span>
                    <Badge tone={ok ? "success" : "danger"}>{ok ? "Autorisé" : "Refusé"}</Badge>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
