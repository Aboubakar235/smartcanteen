import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { EmiMark, Logo, ZelligePattern } from "../components/Logo";
import { Banner } from "../components/ui";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await login(email, motDePasse);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-aside">
        <ZelligePattern id="zellige-login" opacity={0.16} />
        <EmiMark className="emi-watermark" />
        <Logo sub="École Mohammadia d'Ingénieurs" />
        <div>
          <h2>Votre repas, sans faire une longue queue.</h2>
          <p>Réservez un créneau à la cantine, suivez la file depuis votre téléphone et présentez votre ticket à l'entrée.</p>
        </div>
        <ol className="login-steps">
          <li>
            <b>Réserver</b>
            Un repas, un créneau, sur place ou à emporter.
          </li>
          <li>
            <b>Suivre</b>
            Votre position et l'attente estimée en direct.
          </li>
          <li>
            <b>Entrer</b>
            Le QR code de votre ticket est scanné à l'entrée.
          </li>
        </ol>
      </aside>

      <div className="login-panel-wrap">
        <div className="login-panel login-glass">
          <h1>Connexion</h1>
          <p className="lede">Avec votre compte institutionnel de l'université.</p>

          <form className="stack-lg" onSubmit={onSubmit}>
            <Banner>{erreur}</Banner>

            <div className="field">
              <label className="label" htmlFor="email">
                Email institutionnel
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@um5.ac.ma"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="pwd">
                Mot de passe
              </label>
              <input
                id="pwd"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
            </div>

            <button className="btn btn-primary btn-lg btn-block" disabled={envoi}>
              {envoi ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="hint login-note">Pas encore de compte ? Il est créé par l'administration de la cantine.</p>
        </div>
      </div>
    </div>
  );
}
