import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { initiales } from "../../lib/format";
import { Banner, Sheet } from "../ui";
import { IconLogOut } from "../ui/icons";

const MOT_DE_PASSE_MIN = 8;

// Profil de la personne connectée : ses informations et le changement de mot
// de passe (notamment le mot de passe provisoire donné par l'administrateur).
export default function Profil({ roleLabel, onClose }) {
  const { user, token, logout } = useAuth();
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState(null); // { type, message }

  const confirmationDifferente = confirmation.length > 0 && confirmation !== nouveau;

  async function changer(e) {
    e.preventDefault();
    if (nouveau !== confirmation) {
      setRetour({ type: "error", message: "La confirmation ne correspond pas au nouveau mot de passe." });
      return;
    }
    setEnvoi(true);
    setRetour(null);
    try {
      await api.changerMotDePasse(actuel, nouveau, token);
      setRetour({ type: "success", message: "Mot de passe modifié. Utilisez-le à votre prochaine connexion." });
      setActuel("");
      setNouveau("");
      setConfirmation("");
    } catch (e2) {
      setRetour({ type: "error", message: e2.message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Sheet title="Mon profil" onClose={onClose}>
      <div className="row">
        <div className="avatar avatar-lg">{initiales(user.nom)}</div>
        <div className="grow">
          <div className="card-title">{user.nom}</div>
          <div className="card-sub" style={{ overflowWrap: "anywhere" }}>
            {user.emailInstitutionnel}
          </div>
          <div className="hint">{roleLabel}</div>
        </div>
      </div>

      <form className="stack-lg" onSubmit={changer}>
        <h3>Changer mon mot de passe</h3>
        <div className="field">
          <label className="label" htmlFor="mdp-actuel">
            Mot de passe actuel
          </label>
          <input
            id="mdp-actuel"
            className="input"
            type="password"
            autoComplete="current-password"
            value={actuel}
            onChange={(e) => setActuel(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="mdp-nouveau">
            Nouveau mot de passe
          </label>
          <input
            id="mdp-nouveau"
            className="input"
            type="password"
            autoComplete="new-password"
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            minLength={MOT_DE_PASSE_MIN}
            required
          />
          <span className="hint">{MOT_DE_PASSE_MIN} caractères minimum.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="mdp-confirmation">
            Confirmer le nouveau mot de passe
          </label>
          <input
            id="mdp-confirmation"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            aria-invalid={confirmationDifferente}
            required
          />
          {confirmationDifferente && <span className="hint">Les deux mots de passe sont différents.</span>}
        </div>
        <button
          className="btn btn-primary btn-block"
          disabled={envoi || !actuel || nouveau.length < MOT_DE_PASSE_MIN || nouveau !== confirmation}
        >
          {envoi ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}
        </button>
        {retour && <Banner type={retour.type}>{retour.message}</Banner>}
      </form>

      <button type="button" className="btn btn-danger btn-block" onClick={logout}>
        <IconLogOut width={16} height={16} />
        Se déconnecter
      </button>
    </Sheet>
  );
}
