# Smart Canteen

Application de réservation de repas et de gestion de la cantine de l'École Mohammadia d'Ingénieurs (EMI), développée dans le cadre du PGL par **Isaac Din Kaougahi** et **Aboubakar Abdelaziz**, sous la supervision de **Asmaa Retbi**.

Elle couvre les quatre rôles du cahier des charges (Étudiant, Agent de contrôle, Gestionnaire des repas, Administrateur) : réservation d'un créneau, ticket QR, contrôle à l'entrée, suivi de la file, notifications et règles de gestion RG-01 à RG-11.

En ligne : <https://smartcanteen-two.vercel.app>

## Stack technique

| Couche | Choix |
|---|---|
| Backend | Node.js + Express |
| Base de données | PostgreSQL (driver `pg`, SQL brut, transactions et verrous `FOR UPDATE`) |
| Authentification | JWT + bcrypt |
| Ticket | jeton JWT signé, affiché en QR code (`qrcode.react`), lu à la caméra (`jsqr`) |
| Frontend | React 19, Vite, React Router |
| Hébergement | Neon (base), Render (API), Vercel (application) |

## Arborescence

```
smartcanteen/
├── README.md
├── render.yaml                 Déploiement de l'API sur Render
├── docs/
│   └── DEPLOIEMENT.md          Mise en ligne pas à pas (Neon, Render, Vercel)
├── backend/                    API Express
│   ├── db/
│   │   ├── schema.sql          Tables, types et contraintes
│   │   ├── migrations/         Évolutions du schéma, rejouables
│   │   ├── setup.js            Crée le schéma, applique les migrations, charge la démo
│   │   └── seed.js             Données de démonstration
│   └── src/
│       ├── server.js           Démarrage du serveur et du planificateur
│       ├── app.js              Application Express (CORS, routes, erreurs)
│       ├── routes/             Une route par ressource (auth, menus, réservations…)
│       ├── services/           Règles métier (réservations, tickets, notifications, planificateur)
│       ├── middleware/         Authentification et contrôle des rôles
│       └── lib/                Base de données, heure du Maroc, paramètres, erreurs
└── frontend/                   Application React
    ├── index.html
    ├── vite.config.js
    ├── vercel.json             Réécriture des routes pour Vercel
    ├── public/                 Favicon
    └── src/
        ├── main.jsx            Point d'entrée
        ├── App.jsx             Routes de l'application
        ├── api/                Appels à l'API
        ├── context/            Session de l'utilisateur connecté
        ├── lib/                Formats de date et d'heure, effets visuels
        ├── components/
        │   ├── ui/             Composants partagés (boutons, fenêtres, icônes…)
        │   ├── layout/         Barre latérale, navigation mobile, profil
        │   └── marque/         Logo, filigranes, fond animé
        ├── pages/
        │   ├── Connexion.jsx
        │   ├── etudiant/       Menu, tickets, ticket, notifications
        │   ├── agent/          Scanner (caméra ou saisie du numéro)
        │   ├── gestionnaire/   Plats, menus, commandes à emporter
        │   └── administrateur/ Créneaux, comptes, statistiques
        └── styles/
            ├── index.css       Assemble les feuilles ci-dessous, dans l'ordre
            ├── theme.css       Couleurs, typographies, rayons, ombres
            ├── base.css        Styles de base
            ├── ambiance.css    Fond et panneaux
            ├── layout.css      Structure des pages
            ├── composants.css  Boutons, formulaires, badges, fenêtres…
            └── pages/          Styles propres à chaque espace
```

## Installation et lancement

### 1. Base de données et API

```bash
createdb smartcanteen           # PostgreSQL doit être démarré
cd backend
cp .env.example .env            # adapter DATABASE_URL et JWT_SECRET si besoin
npm install
SEED_DEMO=true npm run setup    # crée le schéma, applique les migrations, charge la démo
npm run dev                     # API sur http://localhost:4000 + planificateur
```

### 2. Application

```bash
cd frontend
npm install
npm run dev                     # application sur http://localhost:5173
```

En développement, l'application appelle l'API via `/api`, que Vite redirige vers `http://localhost:4000`. Pour viser une autre API, définissez `VITE_API_URL`.

### 3. Tester le scan sur un téléphone

Les navigateurs n'autorisent la caméra que sur une page en HTTPS. Pour tester depuis un téléphone connecté au **même réseau Wi-Fi** que l'ordinateur :

```bash
cd frontend
npm run dev:mobile              # sert l'application en HTTPS sur le réseau local
```

1. Ouvrez sur le téléphone l'adresse « Network » affichée, par exemple `https://10.72.101.238:5173`.
2. Le certificat est auto-signé : choisissez « Paramètres avancés » puis « Continuer vers le site » (sur iPhone : « Afficher les détails » puis « Visiter ce site web »).
3. Connectez-vous avec le compte agent, mode **Caméra**, et autorisez la caméra.

Si le téléphone n'arrive pas à joindre l'ordinateur, vérifiez le pare-feu de macOS et que le Wi-Fi n'isole pas les appareils (fréquent sur les réseaux d'école : un partage de connexion depuis le téléphone fonctionne alors).

## Mise en ligne

Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md). Chaque envoi sur la branche `main` redéploie automatiquement l'API (Render) et l'application (Vercel).

## Comptes

Il n'y a pas d'inscription libre : l'administrateur crée tous les comptes, étudiants compris, depuis la page **Comptes**, avec un mot de passe provisoire. Chacun le change ensuite depuis son profil.

La démo crée quatre comptes, avec le mot de passe `password123` : `etudiant@um5.ac.ma`, `agent@um5.ac.ma`, `gestionnaire@um5.ac.ma` et `admin@um5.ac.ma`. Changez ces mots de passe sur toute base accessible en ligne.

## Fonctionnalités

- **Étudiant** : consulter le menu du jour (petit-déjeuner, déjeuner, dîner), réserver un créneau sur place ou à emporter, recevoir un ticket QR avec son numéro de passage, suivre sa position dans la file, annuler, consulter ses notifications.
- **Agent de contrôle** : vérifier un ticket à la caméra ou par son numéro, avec les verdicts valide, déjà utilisé, annulé, trop tôt ou expiré.
- **Gestionnaire des repas** : gérer les plats, composer les repas, publier le menu de chaque service sur les créneaux choisis, signaler un repas indisponible (les étudiants concernés sont prévenus), suivre les commandes à emporter, supprimer un plat, un repas ou un menu.
- **Administrateur** : créer et supprimer les créneaux, créer les comptes et gérer leurs mots de passe, suspendre un compte, consulter les statistiques.

## Règles de gestion

RG-01 (une réservation active par service et par jour), RG-02 (ticket utilisé ou annulé non réutilisable), RG-03 (numéro de passage unique, ordre de la file), RG-05/RG-06 (tolérance de retard puis absence automatique), RG-07 (suspension après absences répétées), RG-08 (temps d'attente estimé), RG-10 (notification si un repas devient indisponible), RG-11 (annulation tardive comptée comme absence), EF-13 à EF-15 (capacité, alternatives, limite de réservations).

Un créneau ou un repas déjà réservé ne peut pas être supprimé, pour garder l'historique et les statistiques justes. Un menu ne peut pas être retiré tant que des étudiants ont une réservation en cours dessus.

## Pistes d'évolution

- Connexion par le compte institutionnel de l'université (SSO) ou import de la liste des étudiants.
- Application installable hors ligne (PWA).
