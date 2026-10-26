-- =====================================================================
-- Migration 001 — service « petit-déjeuner » et créneaux par menu
-- Le gestionnaire choisit, pour chaque menu (date + service), les
-- créneaux sur lesquels ses repas sont servis.
-- À appliquer une fois sur une base existante : npm run db:migrate
-- =====================================================================

-- Nouveau service, placé avant le déjeuner dans l'ordre de l'énumération
ALTER TYPE service_enum ADD VALUE IF NOT EXISTS 'PETIT_DEJEUNER' BEFORE 'DEJEUNER';

CREATE TABLE IF NOT EXISTS menu_creneaux (
  menu_id     UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  creneau_id  UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_id, creneau_id)
);
CREATE INDEX IF NOT EXISTS idx_menu_creneaux_creneau ON menu_creneaux(creneau_id);

-- Menus déjà publiés : ils restent réservables sur tous les créneaux de
-- leur date, comme avant la migration.
INSERT INTO menu_creneaux (menu_id, creneau_id)
SELECT m.id, c.id
FROM menus m
JOIN creneaux c ON c.date = m.date
WHERE NOT EXISTS (SELECT 1 FROM menu_creneaux mc WHERE mc.menu_id = m.id)
ON CONFLICT DO NOTHING;
