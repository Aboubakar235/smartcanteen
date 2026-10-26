// Par défaut, l'API est appelée sur la même adresse que la page (proxy Vite
// en développement) : cela marche sur l'ordinateur comme sur un téléphone.
export const API_URL = import.meta.env.VITE_API_URL || "/api";

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(data?.error || "Une erreur est survenue.", res.status, data);
  }
  return data;
}

export const api = {
  login: (emailInstitutionnel, motDePasse) =>
    request("/auth/login", { method: "POST", body: { emailInstitutionnel, motDePasse } }),
  me: (token) => request("/auth/me", { token }),
  changerMotDePasse: (motDePasseActuel, nouveauMotDePasse, token) =>
    request("/auth/mot-de-passe", { method: "POST", body: { motDePasseActuel, nouveauMotDePasse }, token }),

  getMenu: (date, token) => request(`/menus?date=${date}`, { token }),
  getCreneaux: (date, token) => request(`/creneaux?date=${date}`, { token }),

  reserver: (payload, token) => request("/reservations", { method: "POST", body: payload, token }),
  mesReservations: (token) => request("/reservations/mes-reservations", { token }),
  getReservation: (id, token) => request(`/reservations/${id}`, { token }),
  annulerReservation: (id, token) =>
    request(`/reservations/${id}/annuler`, { method: "POST", token }),
  suiviFile: (id, token) => request(`/reservations/${id}/file`, { token }),

  notifications: (token) => request("/notifications", { token }),
  marquerNotificationLue: (id, token) =>
    request(`/notifications/${id}/lu`, { method: "PATCH", token }),

  scanTicket: (payload, token) => request("/tickets/scan", { method: "POST", body: payload, token }),

  // gestionnaire
  getPlats: (token) => request("/plats", { token }),
  creerPlat: (payload, token) => request("/plats", { method: "POST", body: payload, token }),
  getRepas: (token) => request("/repas", { token }),
  creerRepas: (payload, token) => request("/repas", { method: "POST", body: payload, token }),
  creerMenu: (payload, token) => request("/menus", { method: "POST", body: payload, token }),
  repasIndisponible: (id, token) =>
    request(`/repas/${id}/indisponible`, { method: "POST", token }),
  commandes: (creneauId, token) =>
    request(`/commandes${creneauId ? `?creneauId=${creneauId}` : ""}`, { token }),
  majStatutCommande: (id, statut, token) =>
    request(`/commandes/${id}/statut`, { method: "PATCH", body: { statut }, token }),

  // administrateur
  creerCreneau: (payload, token) => request("/creneaux", { method: "POST", body: payload, token }),
  getComptes: (token) => request("/admin/comptes", { token }),
  creerCompte: (payload, token) => request("/admin/comptes", { method: "POST", body: payload, token }),
  majStatutCompte: (id, statut, token) =>
    request(`/admin/comptes/${id}/statut`, { method: "PATCH", body: { statut }, token }),
  reinitialiserMotDePasse: (id, motDePasse, token) =>
    request(`/admin/comptes/${id}/mot-de-passe`, { method: "PATCH", body: { motDePasse }, token }),
  getParametres: (token) => request("/admin/parametres", { token }),
  majParametre: (cle, valeur, token) =>
    request(`/admin/parametres/${cle}`, { method: "PATCH", body: { valeur: String(valeur) }, token }),
  statistiques: (date, token) =>
    request(`/admin/statistiques${date ? `?date=${date}` : ""}`, { token }),
};

export { ApiError };
