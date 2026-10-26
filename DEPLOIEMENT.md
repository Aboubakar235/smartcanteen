# Déployer Smart Canteen en ligne

Objectif : une adresse publique en HTTPS, utilisable sur n'importe quel appareil (téléphone de l'agent, ordinateurs, réseau de l'école ou 4G), sans que votre Mac reste allumé. Tout est gratuit.

| Brique | Service | Rôle |
|---|---|---|
| Base de données | **Neon** (PostgreSQL) | Stocke les données. Gratuit sans limite de durée. |
| API | **Render** | Fait tourner le backend Node (`backend/`). |
| Application | **Vercel** | Sert le front React (`frontend/`). |

Le projet contient déjà la configuration : `render.yaml` (API), `frontend/vercel.json` (front) et `backend/db/setup.js`, qui crée la base et charge la démo au premier démarrage.

Comptez 20 à 30 minutes la première fois. Créez les comptes en vous connectant **avec GitHub** : c'est plus simple pour relier les services.

---

## 1. Mettre le code sur GitHub

1. Sur <https://github.com/new>, créez un dépôt **vide** nommé `smartcanteen` (privé ou public), **sans** README ni `.gitignore`.
2. Dans un terminal, depuis le dossier du projet :

   ```bash
   git remote add origin https://github.com/VOTRE-PSEUDO/smartcanteen.git
   git push -u origin main
   ```

   Si Git demande un mot de passe, utilisez un **jeton d'accès** GitHub (Settings > Developer settings > Personal access tokens), pas le mot de passe du compte. L'application GitHub Desktop évite cette étape.

Les fichiers `.env` ne sont jamais envoyés (ils sont exclus par `.gitignore`).

## 2. Créer la base sur Neon

1. Sur <https://neon.tech>, créez un projet `smartcanteen`. Région : **Europe (Frankfurt)**, la plus proche du Maroc.
2. Dans **Connect**, copiez la chaîne de connexion. Elle ressemble à :

   ```
   postgresql://utilisateur:motdepasse@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

   Gardez-la pour l'étape suivante. C'est un secret : ne la mettez pas dans le code.

Inutile de créer les tables : l'API le fait toute seule au premier démarrage.

## 3. Déployer l'API sur Render

1. Sur <https://render.com>, cliquez **New > Blueprint**, puis choisissez le dépôt `smartcanteen`. Render lit `render.yaml`.
2. Render demande deux valeurs :
   - **`DATABASE_URL`** : collez la chaîne Neon de l'étape 2.
   - **`CORS_ORIGIN`** : laissez vide pour l'instant (vous la remplirez à l'étape 5).
3. Cliquez **Apply**. Le `JWT_SECRET` est généré automatiquement.
4. Attendez la fin du déploiement (quelques minutes). Dans les journaux, vous devez voir `Schéma créé`, puis `Seed terminé`.
5. Notez l'adresse de l'API, par exemple `https://smartcanteen-api.onrender.com`, et ouvrez `https://smartcanteen-api.onrender.com/api/health` : la page doit afficher `{"ok":true}`.

## 4. Déployer l'application sur Vercel

1. Sur <https://vercel.com>, cliquez **Add New > Project** et importez le dépôt `smartcanteen`.
2. Réglages :
   - **Root Directory** : `frontend`
   - **Framework Preset** : Vite (détecté automatiquement)
   - **Environment Variables** : `VITE_API_URL` = l'adresse Render suivie de `/api`, par exemple `https://smartcanteen-api.onrender.com/api`
3. Cliquez **Deploy**, puis notez l'adresse obtenue, par exemple `https://smartcanteen.vercel.app`.

## 5. Autoriser l'application à appeler l'API

Sur Render, dans le service `smartcanteen-api` > **Environment**, mettez `CORS_ORIGIN` = l'adresse Vercel (sans `/` final), par exemple `https://smartcanteen.vercel.app`. Enregistrez : l'API redémarre.

## 6. Tester

Ouvrez l'adresse Vercel sur chaque appareil. Comptes de démonstration, mot de passe `password123` :

| Rôle | Email |
|---|---|
| Étudiant | etudiant@um5.ac.ma |
| Agent de contrôle | agent@um5.ac.ma |
| Gestionnaire des repas | gestionnaire@um5.ac.ma |
| Administrateur | admin@um5.ac.ma |

La page est en HTTPS : la caméra fonctionne sur le téléphone de l'agent pour scanner les QR codes. Pour un vrai parcours, l'administrateur crée des créneaux, le gestionnaire publie un menu sur ces créneaux, puis l'étudiant réserve.

## Mettre à jour

Après une modification : `git add -A`, `git commit -m "…"`, puis `git push`. Render et Vercel redéploient automatiquement.

## À savoir

- **Mise en veille** : l'API gratuite de Render s'endort après 15 minutes sans visite. La première ouverture qui suit prend environ 50 secondes. Le passage automatique des absences ne tourne que lorsque l'API est réveillée.
- **Données de démonstration** : chargées seulement si la base est vide. Avant une utilisation réelle, changez les mots de passe des comptes de démo, puis passez `SEED_DEMO` à `false` sur Render.
- **Heure** : l'API donne l'heure du Maroc à toute l'application, quelle que soit la région du serveur.

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| Page blanche ou « Une erreur est survenue » à la connexion | `VITE_API_URL` absente ou fausse sur Vercel. Corrigez-la puis **redéployez** (Deployments > Redeploy) : la valeur est intégrée au moment du build. |
| Erreur CORS dans la console du navigateur | `CORS_ORIGIN` sur Render ne correspond pas exactement à l'adresse Vercel. |
| Le déploiement Render échoue au démarrage | `DATABASE_URL` incorrecte, ou sans `?sslmode=require`. Les journaux Render indiquent la cause. |
| `JWT_SECRET doit être défini…` dans les journaux | Le secret a été supprimé : remettez une longue valeur aléatoire. |
