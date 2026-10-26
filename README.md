# Smart Canteen — MVP

Application de réservation de repas et de gestion de la cantine de l'École Mohammadia d'Ingénieurs (EMI), développée dans le cadre du PGL par **Isaac Din Kaougahi** et **Aboubakar Abdelaziz**, sous la supervision de **Asmaa Retbi**.

Ce dépôt contient le MVP conforme au cahier des charges v2.0 et à la planification agile (backlog de user stories) : les 4 rôles (Étudiant, Agent de contrôle, Gestionnaire des repas, Administrateur), le flux complet de réservation → ticket QR → contrôle d'accès, le suivi de file en temps quasi réel, les notifications et les règles de gestion (RG-01 à RG-11).

## Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Backend | Node.js + Express | léger, conforme TECH-01/TECH-02 |
| Base de données | PostgreSQL 16 (driver `pg`, SQL brut) | TECH-04 ; Prisma écarté car son moteur binaire est bloqué par le réseau sandboxé du poste de dev — aucune perte fonctionnelle (transactions `BEGIN/COMMIT`, contraintes, verrous `FOR UPDATE`) |
| Authentification | JWT + bcrypt | TECH-05 |
| QR Code / ticket | jeton JWT signé (génération) + `qrcode.react` (rendu côté client) | TECH-06 |
| Frontend | React 19 (Vite) + React Router | mobile-first, ENF-02/ENF-19 |

## Arborescence

```
smartcanteen/
├── backend/        API Express (routes, services métier, planificateur)
│   └── db/schema.sql, seed.js
└── frontend/        Application React (étudiant, agent, gestionnaire, administrateur)
```

## Installation et lancement

### 1. Base de données

```bash
# PostgreSQL doit être démarré (pg_ctlcluster 16 main start, ou service local)
createdb smartcanteen
cd backend
cp .env.example .env   # adapter DATABASE_URL / JWT_SECRET si besoin
npm install
npm run db:init        # applique db/schema.sql
npm run seed            # crée les 4 comptes de démo + données d'exemple
```

**Base déjà existante** (créée avant l'ajout du petit-déjeuner) : appliquez une fois la migration qui ajoute le service `PETIT_DEJEUNER` et le lien entre menus et créneaux. Les menus déjà publiés restent réservables sur tous les créneaux de leur journée.

```bash
psql "postgresql://postgres:postgres@localhost:5432/smartcanteen" -f db/migrations/001_petit_dejeuner_creneaux_menu.sql
```

### 2. Backend

```bash
cd backend
npm run dev             # démarre l'API sur http://localhost:4000 + le planificateur (TECH-09)
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev              # démarre l'app sur http://localhost:5173
```

En développement, le front appelle l'API via `/api`, que Vite redirige vers `http://localhost:4000`. Pour viser une autre API, définissez `VITE_API_URL`.

### 4. Tester sur un téléphone (scan des QR codes par l'agent)

Les navigateurs n'autorisent la caméra que sur une page en HTTPS. Pour tester depuis un téléphone connecté au **même réseau Wi-Fi** que l'ordinateur :

```bash
cd frontend
npm run dev:mobile      # sert l'application en HTTPS sur le réseau local
```

1. Le terminal affiche une adresse « Network », par exemple `https://10.72.101.238:5173`. Ouvrez-la sur le téléphone.
2. Le navigateur prévient que le certificat n'est pas reconnu (il est auto-signé, pour le développement) : choisissez « Paramètres avancés » puis « Continuer vers le site » (sur iPhone : « Afficher les détails » puis « Visiter ce site web »).
3. Connectez-vous avec `agent@um5.ac.ma`, mode **Caméra**, et autorisez l'accès à la caméra.

Le backend doit tourner en même temps (`npm run dev` dans `backend`). Si le téléphone n'arrive pas à joindre l'ordinateur, vérifiez que le pare-feu de macOS autorise les connexions entrantes pour Node, et que le Wi-Fi n'isole pas les appareils entre eux (fréquent sur les réseaux publics ou d'école : un partage de connexion depuis le téléphone fonctionne alors). En production, un vrai certificat HTTPS remplace cette configuration.

## Déploiement en ligne

Pour obtenir une adresse publique en HTTPS (Neon + Render + Vercel, offres gratuites), suivez [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Comptes de démonstration

Mot de passe pour tous : `password123`

| Rôle | Email |
|---|---|
| Étudiant | etudiant@um5.ac.ma |
| Agent de contrôle | agent@um5.ac.ma |
| Gestionnaire des repas | gestionnaire@um5.ac.ma |
| Administrateur | admin@um5.ac.ma |

## Parcours couverts (MVP)

- **Étudiant** : consulter le menu du jour, réserver un passage (sur place / à emporter), recevoir un ticket avec QR code et numéro de passage, suivre sa position dans la file et le temps d'attente estimé, annuler une réservation, consulter ses notifications.
- **Agent de contrôle** : vérifier un ticket par numéro de passage (scan QR prévu côté lecture du jeton, saisie manuelle en repli — EF-31), avec les verdicts valide / déjà utilisé / annulé / trop tôt / expiré.
- **Gestionnaire des repas** : créer des plats, composer des repas, publier le menu du jour par service, signaler un repas indisponible (notifie automatiquement les étudiants concernés), suivre et faire progresser les commandes à emporter.
- **Administrateur** : créer les créneaux et leur capacité, gérer les comptes du personnel (créer/suspendre), consulter les statistiques (affluence, taux d'absence, repas les plus demandés).

## Règles de gestion implémentées

RG-01 (une réservation active par service/jour), RG-02 (ticket utilisé/annulé non réutilisable), RG-03 (numéro de passage unique, ordre de file), RG-05/RG-06 (tolérance de retard → absence automatique via le planificateur), RG-07 (suspension après absences répétées), RG-08 (temps d'attente estimé), RG-10 (notification de tous les étudiants concernés si repas indisponible), RG-11 (annulation tardive comptée comme absence), EF-13 à EF-15 (capacité, alternatives, limite de réservations).

## Prochaines étapes (hors MVP)

- Mise en forme visuelle avancée (le design actuel est volontairement simple : palette "ticket de cantine", typographies Space Grotesk/Inter).
- SSO institutionnel pour les étudiants (actuellement un `/auth/register` de démonstration).
- PWA complète (service worker, mode hors-ligne) — la base mobile-first est déjà en place.
