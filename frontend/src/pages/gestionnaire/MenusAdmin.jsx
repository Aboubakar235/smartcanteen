import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { Banner, PageHeader, Segmented } from "../../components/ui";
import { IconPlus } from "../../components/icons";
import { aujourdhui, dateLongue, plage, SERVICE_LABEL } from "../../lib/format";

const SERVICES = Object.entries(SERVICE_LABEL).map(([value, label]) => ({ value, label }));

export default function MenusAdmin() {
  const { token } = useAuth();
  const [plats, setPlats] = useState([]);
  const [repasListe, setRepasListe] = useState([]);
  const [erreur, setErreur] = useState(null);
  // Chaque formulaire affiche son résultat juste à côté de son bouton.
  const [retourRepas, setRetourRepas] = useState(null); // { type, message }
  const [retourMenu, setRetourMenu] = useState(null);

  // Composer un repas
  const [nomRepas, setNomRepas] = useState("");
  const [platIds, setPlatIds] = useState([]);
  const [quantite, setQuantite] = useState(60);
  const [envoiRepas, setEnvoiRepas] = useState(false);

  // Planifier le menu d'une date : service, repas et créneaux de service
  const [dateMenu, setDateMenu] = useState(aujourdhui());
  const [service, setService] = useState("DEJEUNER");
  const [repasChoisis, setRepasChoisis] = useState([]);
  const [creneauxDate, setCreneauxDate] = useState([]);
  const [menusDate, setMenusDate] = useState([]);
  const [creneauxChoisis, setCreneauxChoisis] = useState([]);
  const [envoiMenu, setEnvoiMenu] = useState(false);

  useEffect(() => {
    Promise.all([api.getPlats(token), api.getRepas(token)])
      .then(([p, r]) => {
        setPlats(p);
        setRepasListe(r);
      })
      .catch((e) => setErreur(e.message));
  }, [token]);

  // Créneaux et menus déjà publiés sont propres à une date : on les recharge quand elle change.
  const chargerDate = useCallback(() => {
    return Promise.all([api.getCreneaux(dateMenu, token), api.getMenu(dateMenu, token)])
      .then(([c, m]) => {
        setCreneauxDate(c);
        setMenusDate(m);
      })
      .catch((e) => setErreur(e.message));
  }, [dateMenu, token]);

  useEffect(() => {
    chargerDate();
  }, [chargerDate]);

  // Si ce service a déjà un menu, ses créneaux actuels sont présélectionnés :
  // le gestionnaire voit ce qu'il modifie, la publication les remplace.
  const menuExistant = menusDate.find((m) => m.service === service);
  const creneauxActuels = menuExistant?.creneauIds ?? [];
  const cleMenu = `${dateMenu}|${service}|${creneauxActuels.join(",")}`;
  const [cleSelection, setCleSelection] = useState(null);
  // Un nouveau menu a besoin d'au moins un repas ; un menu existant peut ne changer que ses créneaux.
  const manqueRepas = repasChoisis.length === 0 && !menuExistant;
  if (cleSelection !== cleMenu) {
    setCleSelection(cleMenu);
    setCreneauxChoisis(creneauxActuels);
  }

  function toggleCreneau(id) {
    setRetourMenu(null);
    setCreneauxChoisis((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function togglePlat(id) {
    setPlatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleRepas(id) {
    setRetourMenu(null);
    setRepasChoisis((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function composerRepas(e) {
    e.preventDefault();
    setEnvoiRepas(true);
    setRetourRepas(null);
    try {
      const r = await api.creerRepas(
        { nom: nomRepas, platIds, quantiteDisponible: Number(quantite) },
        token
      );
      setRepasListe((prev) => [r, ...prev]);
      setRepasChoisis((prev) => [...prev, r.id]);
      setNomRepas("");
      setPlatIds([]);
      setRetourRepas({
        type: "success",
        message: `Repas « ${r.nom} » créé. Il est déjà coché à l'étape 2 : choisissez ses créneaux puis publiez.`,
      });
    } catch (e2) {
      setRetourRepas({ type: "error", message: e2.message });
    } finally {
      setEnvoiRepas(false);
    }
  }

  async function signalerIndisponible(repasId) {
    setRetourMenu(null);
    try {
      const res = await api.repasIndisponible(repasId, token);
      setRetourMenu({
        type: "success",
        message: `Repas signalé indisponible : ${res.etudiantsNotifies} étudiant(s) prévenu(s).`,
      });
      setRepasListe((prev) => prev.filter((r) => r.id !== repasId));
      setRepasChoisis((prev) => prev.filter((x) => x !== repasId));
    } catch (e) {
      setRetourMenu({ type: "error", message: e.message });
    }
  }

  async function planifierMenu(e) {
    e.preventDefault();
    setEnvoiMenu(true);
    setRetourMenu(null);
    try {
      const menu = await api.creerMenu(
        { date: dateMenu, service, repasIds: repasChoisis, creneauIds: creneauxChoisis },
        token
      );
      const quoi = `${SERVICE_LABEL[service]} du ${dateLongue(dateMenu)}`;
      const combien = repasChoisis.length
        ? `${repasChoisis.length} repas ajouté(s), ${creneauxChoisis.length} créneau(x)`
        : `${creneauxChoisis.length} créneau(x)`;
      setRetourMenu({
        type: "success",
        message: menu.complete
          ? `${quoi} mis à jour (${combien}). Les étudiants ne peuvent réserver que sur ces créneaux.`
          : `${quoi} publié (${combien}). Les étudiants peuvent réserver.`,
      });
      setRepasChoisis([]);
      await chargerDate();
    } catch (e2) {
      setRetourMenu({ type: "error", message: e2.message });
    } finally {
      setEnvoiMenu(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow={dateLongue()} title="Menus du jour" sub="Composez les repas puis publiez le menu." />

      <div className="stack-lg">
        <Banner>{erreur}</Banner>

        <form className="card card-pad-lg stack-lg" onSubmit={composerRepas}>
          <div>
            <p className="hint">Étape 1</p>
            <h2>Composer un repas</h2>
          </div>

          <div className="field">
            <label className="label" htmlFor="nomRepas">
              Nom du repas
            </label>
            <input
              id="nomRepas"
              className="input"
              value={nomRepas}
              onChange={(e) => setNomRepas(e.target.value)}
              placeholder="Menu du jour — Couscous"
              required
            />
          </div>

          <div className="field">
            <span className="label">
              Plats inclus {platIds.length > 0 && <span className="muted">· {platIds.length} sélectionné(s)</span>}
            </span>
            {plats.length === 0 ? (
              <p className="hint">Aucun plat dans le catalogue. Ajoutez-en depuis l'onglet Plats.</p>
            ) : (
              <div className="chips">
                {plats.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="chip"
                    aria-pressed={platIds.includes(p.id)}
                    onClick={() => togglePlat(p.id)}
                  >
                    {p.nom}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-grid cols-2">
            <div className="field">
              <label className="label" htmlFor="qte">
                Quantité disponible
              </label>
              <input
                id="qte"
                className="input"
                type="number"
                min="1"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
              />
            </div>
          </div>

          <div className="stack">
            <div>
              <button className="btn btn-primary" disabled={platIds.length === 0 || envoiRepas}>
                <IconPlus width={16} height={16} />
                {envoiRepas ? "Création…" : "Créer le repas"}
              </button>
            </div>
            {retourRepas && <Banner type={retourRepas.type}>{retourRepas.message}</Banner>}
          </div>
        </form>

        <form className="card card-pad-lg stack-lg" onSubmit={planifierMenu}>
          <div>
            <p className="hint">Étape 2</p>
            <h2>Publier le menu</h2>
          </div>

          {repasListe.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Aucun repas disponible. Composez-en un à l'étape 1.
            </p>
          ) : (
            <>
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="dateMenu">
                    Date
                  </label>
                  <input
                    id="dateMenu"
                    className="input"
                    type="date"
                    min={aujourdhui()}
                    value={dateMenu}
                    onChange={(e) => setDateMenu(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <span className="label">Service</span>
                  <Segmented label="Service" value={service} onChange={setService} options={SERVICES} />
                </div>
              </div>

              <div className="field">
                <span className="label" id="label-creneaux-menu">
                  Créneaux où ce repas est servi
                  {creneauxChoisis.length > 0 && <span className="muted"> · {creneauxChoisis.length} choisi(s)</span>}
                </span>
                {creneauxDate.length === 0 ? (
                  <p className="hint">
                    Aucun créneau n'existe à cette date. L'administrateur doit d'abord les créer dans « Créneaux ».
                  </p>
                ) : (
                  <div className="chips" role="group" aria-labelledby="label-creneaux-menu">
                    {creneauxDate.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="chip mono"
                        aria-pressed={creneauxChoisis.includes(c.id)}
                        onClick={() => toggleCreneau(c.id)}
                      >
                        {plage(c.heureDebut, c.heureFin)}
                      </button>
                    ))}
                  </div>
                )}
                <span className="hint">
                  {menuExistant
                    ? `Ce ${SERVICE_LABEL[service].toLowerCase()} est déjà publié : ses créneaux actuels sont cochés. Publier remplace ces créneaux par votre sélection.`
                    : "Les étudiants ne pourront réserver ce menu que sur ces horaires."}
                </span>
              </div>

              <div className="field">
                <span className="label">Repas à publier</span>
                <div className="card list-card" style={{ boxShadow: "none" }}>
                  {repasListe.map((r) => (
                    <div key={r.id} className="list-row">
                      <label className="row grow" style={{ cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={repasChoisis.includes(r.id)}
                          onChange={() => toggleRepas(r.id)}
                          style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                        />
                        <span style={{ fontWeight: 500 }}>{r.nom}</span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => signalerIndisponible(r.id)}
                      >
                        Signaler indisponible
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="stack">
                <div>
                  <button
                    className="btn btn-primary"
                    disabled={manqueRepas || creneauxChoisis.length === 0 || envoiMenu}
                  >
                    {envoiMenu ? "Publication…" : menuExistant ? "Mettre à jour le menu" : "Publier le menu"}
                  </button>
                </div>
                {!retourMenu && (manqueRepas || creneauxChoisis.length === 0) && (
                  <p className="hint">
                    {manqueRepas && creneauxChoisis.length === 0
                      ? "Cochez au moins un repas et choisissez au moins un créneau pour publier."
                      : manqueRepas
                        ? "Cochez au moins un repas à publier."
                        : "Choisissez au moins un créneau."}
                  </p>
                )}
                {retourMenu && <Banner type={retourMenu.type}>{retourMenu.message}</Banner>}
              </div>
            </>
          )}
        </form>
      </div>
    </>
  );
}
