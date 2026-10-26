import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/ui/EmptyState";
import { Banner, Confirmation, PageHeader, Section, Skeleton } from "../../components/ui";
import { IconTray, IconPlus, IconTrash } from "../../components/ui/icons";

const CATEGORIES = ["Plat principal", "Accompagnement", "Entrée", "Dessert", "Boisson"];

export default function Plats() {
  const { token } = useAuth();
  const [plats, setPlats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null);

  const fermerSuppression = useCallback(() => setASupprimer(null), []);

  function recharger() {
    api.getPlats(token).then(setPlats).catch((e) => setErreur(e.message)).finally(() => setLoading(false));
  }

  useEffect(recharger, [token]);

  async function ajouter(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await api.creerPlat({ nom, categorie, allergenes: [] }, token);
      setNom("");
      setCategorie("");
      recharger();
    } catch (e2) {
      setErreur(e2.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer() {
    await api.supprimerPlat(aSupprimer.id, token);
    setPlats((prev) => prev.filter((p) => p.id !== aSupprimer.id));
  }

  return (
    <>
      <PageHeader title="Catalogue des plats" sub="Les plats servent à composer les repas du menu." />

      <form className="card card-pad-lg stack-lg" onSubmit={ajouter}>
        <h2>Ajouter un plat</h2>
        <Banner>{erreur}</Banner>
        <div className="form-grid cols-2">
          <div className="field">
            <label className="label" htmlFor="nom">
              Nom du plat
            </label>
            <input
              id="nom"
              className="input"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Tajine de poulet"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="categorie">
              Catégorie
            </label>
            <input
              id="categorie"
              className="input"
              list="categories"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Plat principal"
              required
            />
            <datalist id="categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <button className="btn btn-primary" disabled={envoi}>
            <IconPlus width={16} height={16} />
            {envoi ? "Ajout…" : "Ajouter le plat"}
          </button>
        </div>
      </form>

      <Section title="Plats" count={loading ? null : plats.length}>
        {loading ? (
          <Skeleton count={3} height={60} />
        ) : plats.length === 0 ? (
          <EmptyState icon={IconTray} title="Aucun plat" hint="Ajoutez votre premier plat ci-dessus." />
        ) : (
          <div className="card list-card">
            {plats.map((p) => (
              <div key={p.id} className="list-row">
                <div className="grow">
                  <div className="card-title">{p.nom}</div>
                  <div className="card-sub">{p.categorie}</div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Supprimer ${p.nom}`}
                  onClick={() => setASupprimer(p)}
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {aSupprimer && (
        <Confirmation
          title={`Supprimer « ${aSupprimer.nom} » ?`}
          message="Le plat ne sera plus proposé pour composer de nouveaux repas. Les repas déjà composés ne changent pas."
          onConfirm={supprimer}
          onClose={fermerSuppression}
        />
      )}
    </>
  );
}
