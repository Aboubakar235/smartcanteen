import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { Banner, Meter, PageHeader, Section, Skeleton } from "../../components/ui";
import { dateCourte } from "../../lib/format";

function Barres({ lignes }) {
  if (lignes.length === 0) return <p className="hint">Pas encore de données.</p>;
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  return (
    <div className="bars">
      {lignes.map((l) => (
        <div key={l.cle} className="bar-row">
          <div className="bar-top">
            <span>{l.libelle}</span>
            <span className="n">{l.valeur}</span>
          </div>
          <Meter value={l.valeur} max={max} seuils={false} />
        </div>
      ))}
    </div>
  );
}

export default function Statistiques() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api.statistiques(null, token).then(setStats).catch((e) => setErreur(e.message));
  }, [token]);

  if (erreur)
    return (
      <>
        <PageHeader title="Statistiques" />
        <Banner>{erreur}</Banner>
      </>
    );

  if (!stats)
    return (
      <>
        <PageHeader title="Statistiques" />
        <Skeleton count={3} height={110} />
      </>
    );

  const totalReservations = stats.affluenceParJour.reduce((s, j) => s + Number(j.total_reservations), 0);

  return (
    <>
      <PageHeader title="Statistiques" sub="Affluence, absences et repas les plus demandés." />

      <div className="stat-grid">
        <div className="stat">
          <p className="k">Réservations</p>
          <p className="v">{totalReservations}</p>
        </div>
        <div className="stat">
          <p className="k">Taux d'absence</p>
          <p className="v">{(stats.tauxAbsence * 100).toFixed(1)}%</p>
        </div>
        <div className="stat">
          <p className="k">Jours suivis</p>
          <p className="v">{stats.affluenceParJour.length}</p>
        </div>
      </div>

      <Section title="Affluence par jour">
        <div className="card card-pad-lg">
          <Barres
            lignes={stats.affluenceParJour.map((j) => ({
              cle: j.date,
              libelle: dateCourte(String(j.date).slice(0, 10)),
              valeur: Number(j.total_reservations),
            }))}
          />
        </div>
      </Section>

      <Section title="Repas les plus demandés">
        <div className="card card-pad-lg">
          <Barres
            lignes={stats.repasLesPlusDemandes.map((r) => ({ cle: r.nom, libelle: r.nom, valeur: Number(r.total) }))}
          />
        </div>
      </Section>
    </>
  );
}
