import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import EmptyState from "../../components/EmptyState";
import { PageHeader, Skeleton } from "../../components/ui";
import { IconBell } from "../../components/icons";
import { dateHeure } from "../../lib/format";

export default function Notifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.notifications(token).then(setNotifications).finally(() => setLoading(false));
  }, [token]);

  async function marquerLue(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
    try {
      await api.marquerNotificationLue(id, token);
    } catch {
      // l'état reste optimiste même en cas d'échec réseau
    }
  }

  const nonLues = notifications.filter((n) => !n.lu).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        sub={nonLues > 0 ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Vous êtes à jour."}
      />

      {loading ? (
        <Skeleton count={4} height={64} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={IconBell}
          title="Aucune notification"
          hint="Vous serez prévenu ici des mises à jour sur vos réservations."
        />
      ) : (
        <div className="card list-card">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className="list-row"
              onClick={() => !n.lu && marquerLue(n.id)}
              style={{
                width: "100%",
                border: 0,
                background: "transparent",
                textAlign: "left",
                cursor: n.lu ? "default" : "pointer",
              }}
              aria-label={n.lu ? undefined : `Marquer comme lue : ${n.message}`}
            >
              <div className="grow">
                <p style={{ fontWeight: n.lu ? 400 : 500, color: n.lu ? "var(--ink-2)" : "var(--ink)" }}>
                  {n.message}
                </p>
                <p className="hint" style={{ marginTop: 2 }}>
                  {dateHeure(n.dateEnvoi)}
                </p>
              </div>
              {!n.lu && <span className="dot" title="Non lue" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
