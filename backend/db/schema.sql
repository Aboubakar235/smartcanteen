-- =====================================================================
-- Smart Canteen — schéma de base de données PostgreSQL
-- Conforme au §5.1 (Données principales) et §6 (Règles de gestion)
-- du cahier des charges v2.0.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- pour gen_random_uuid()

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
CREATE TYPE role_enum AS ENUM ('ETUDIANT', 'AGENT_CONTROLE', 'GESTIONNAIRE_REPAS', 'ADMINISTRATEUR');
CREATE TYPE service_enum AS ENUM ('PETIT_DEJEUNER', 'DEJEUNER', 'DINER');
CREATE TYPE mode_enum AS ENUM ('SUR_PLACE', 'A_EMPORTER');
CREATE TYPE etat_reservation_enum AS ENUM
  ('CONFIRMEE', 'EN_ATTENTE', 'APPELEE', 'ENTREE', 'SERVIE', 'TERMINEE', 'ANNULEE', 'ABSENTE', 'EXPIREE');
CREATE TYPE statut_commande_enum AS ENUM ('EN_ATTENTE', 'EN_PREPARATION', 'PRETE', 'RECUPEREE');

-- ---------------------------------------------------------------------
-- Utilisateur (EF-01, EF-02)
-- ---------------------------------------------------------------------
CREATE TABLE utilisateurs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                   TEXT NOT NULL,
  email_institutionnel  TEXT NOT NULL UNIQUE,
  mot_de_passe_hash     TEXT NOT NULL,
  role                  role_enum NOT NULL,
  statut                TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu')),
  date_fin_suspension   TIMESTAMPTZ,
  absences_recentes     INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Plat (EF-03)
-- ---------------------------------------------------------------------
CREATE TABLE plats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT NOT NULL,
  description   TEXT,
  categorie     TEXT NOT NULL,
  allergenes    TEXT[] NOT NULL DEFAULT '{}',
  photo_url     TEXT,
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  cree_par_id   UUID NOT NULL REFERENCES utilisateurs(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Repas (EF-04, EF-06, EF-07)
-- ---------------------------------------------------------------------
CREATE TABLE repas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                  TEXT NOT NULL,
  prix_indicatif       NUMERIC(8,2) NOT NULL DEFAULT 0,
  quantite_disponible  INTEGER NOT NULL CHECK (quantite_disponible >= 0),
  quantite_restante    INTEGER NOT NULL CHECK (quantite_restante >= 0),
  disponible           BOOLEAN NOT NULL DEFAULT TRUE,
  cree_par_id          UUID NOT NULL REFERENCES utilisateurs(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE repas_plats (
  repas_id  UUID NOT NULL REFERENCES repas(id) ON DELETE CASCADE,
  plat_id   UUID NOT NULL REFERENCES plats(id) ON DELETE CASCADE,
  PRIMARY KEY (repas_id, plat_id)
);

-- ---------------------------------------------------------------------
-- Menu (EF-05, EF-09)
-- ---------------------------------------------------------------------
CREATE TABLE menus (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  service      service_enum NOT NULL,
  cree_par_id  UUID NOT NULL REFERENCES utilisateurs(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, service)
);

CREATE TABLE menu_repas (
  menu_id   UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  repas_id  UUID NOT NULL REFERENCES repas(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_id, repas_id)
);

-- ---------------------------------------------------------------------
-- Créneau (EF-11, EF-37) — capacité par défaut 60 (§6.1)
-- ---------------------------------------------------------------------
CREATE TABLE creneaux (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date               DATE NOT NULL,
  heure_debut        TIMESTAMPTZ NOT NULL,
  heure_fin          TIMESTAMPTZ NOT NULL,
  capacite_max       INTEGER NOT NULL DEFAULT 60 CHECK (capacite_max > 0),
  capacite_restante  INTEGER NOT NULL CHECK (capacite_restante >= 0),
  gere_par_id        UUID REFERENCES utilisateurs(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_creneaux_date ON creneaux(date);

-- Créneaux sur lesquels les repas d'un menu sont servis (choisis par le gestionnaire)
CREATE TABLE menu_creneaux (
  menu_id     UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  creneau_id  UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_id, creneau_id)
);
CREATE INDEX idx_menu_creneaux_creneau ON menu_creneaux(creneau_id);

-- ---------------------------------------------------------------------
-- Réservation (EF-12 à EF-17) — RG-01 à RG-12
-- ---------------------------------------------------------------------
CREATE TABLE reservations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_passage    TEXT NOT NULL,          -- unique par jour (RG-03), voir index ci-dessous
  mode              mode_enum NOT NULL,
  etat              etat_reservation_enum NOT NULL DEFAULT 'CONFIRMEE',
  statut_commande   statut_commande_enum,   -- rempli seulement si mode = A_EMPORTER (EF-33, EF-34)
  date_creation     TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_annulation   TIMESTAMPTZ,
  etudiant_id       UUID NOT NULL REFERENCES utilisateurs(id),
  creneau_id        UUID NOT NULL REFERENCES creneaux(id),
  repas_id          UUID NOT NULL REFERENCES repas(id)
);
CREATE INDEX idx_reservations_etudiant ON reservations(etudiant_id);
CREATE INDEX idx_reservations_creneau ON reservations(creneau_id);
-- RG-03 : le numéro de passage est unique par jour (date du créneau associé) — appliqué en code
--         via une contrainte applicative, car PostgreSQL ne permet pas un index cross-table simple ici.

CREATE TABLE historique_etats (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  etat           etat_reservation_enum NOT NULL,
  date           TIMESTAMPTZ NOT NULL DEFAULT now(),
  auteur         TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- Ticket (EF-18 à EF-20) — RG-02
-- ---------------------------------------------------------------------
CREATE TABLE tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID NOT NULL UNIQUE REFERENCES reservations(id),
  qr_code_jeton     TEXT NOT NULL UNIQUE,
  date_generation   TIMESTAMPTZ NOT NULL DEFAULT now(),
  validite_debut    TIMESTAMPTZ NOT NULL,
  validite_fin      TIMESTAMPTZ NOT NULL,
  utilise           BOOLEAN NOT NULL DEFAULT FALSE,
  date_utilisation  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- ScanLog (EF-32, ENF-16) — traçabilité des scans
-- ---------------------------------------------------------------------
CREATE TABLE scan_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID REFERENCES tickets(id),
  agent_id    UUID REFERENCES utilisateurs(id),
  verdict     TEXT NOT NULL,
  date_heure  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Notification (EF-24 à EF-28)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id  UUID NOT NULL REFERENCES utilisateurs(id),
  reservation_id   UUID REFERENCES reservations(id),
  type             TEXT NOT NULL,
  message          TEXT NOT NULL,
  date_envoi       TIMESTAMPTZ NOT NULL DEFAULT now(),
  lu               BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_notifications_destinataire ON notifications(destinataire_id);

-- ---------------------------------------------------------------------
-- Paramètre (EF-38, §6.1)
-- ---------------------------------------------------------------------
CREATE TABLE parametres (
  cle          TEXT PRIMARY KEY,
  valeur       TEXT NOT NULL,
  description  TEXT
);

INSERT INTO parametres (cle, valeur, description) VALUES
  ('anticipation_max_jours', '2', 'Anticipation maximale de réservation (jours)'),
  ('fermeture_min_avant_creneau', '30', 'Fermeture des réservations avant le créneau (minutes)'),
  ('reservations_actives_max', '1', 'Réservations actives par étudiant, par service et par jour'),
  ('delai_modif_annulation_min', '30', 'Délai limite de modification/annulation avant le créneau (minutes)'),
  ('duree_creneau_min', '30', 'Durée d''un créneau (minutes)'),
  ('capacite_creneau_defaut', '60', 'Capacité maximale par défaut d''un créneau'),
  ('commandes_emporter_max', '20', 'Commandes à emporter maximales par créneau'),
  ('validite_ticket_avant_min', '10', 'Validité du ticket avant le créneau (minutes)'),
  ('validite_ticket_apres_min', '15', 'Validité du ticket après la fin du créneau (minutes)'),
  ('tolerance_retard_min', '10', 'Tolérance de retard (minutes)'),
  ('absence_apres_depassement_min', '15', 'Réservation marquée absente après ce dépassement (minutes)'),
  ('absences_suspension_seuil', '3', 'Nombre d''absences en 30 jours déclenchant une suspension'),
  ('suspension_duree_jours', '7', 'Durée de suspension (jours)'),
  ('seuil_notification_approche', '10', 'Nombre de personnes devant l''étudiant déclenchant la notification d''approche');
