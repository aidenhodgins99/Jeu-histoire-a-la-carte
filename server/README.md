# Serveur — Civilisation en classe

Backend Node.js/Express qui fait tourner le jeu en ligne : une civilisation persistante
par élève, un tableau de bord enseignant, et tout le contenu (cartes, unités, territoires,
événements) chargé directement depuis les fichiers CSV de `cartes/`.

## Lancer en local

```bash
npm install
cp .env.example .env   # puis remplir DATABASE_URL et COOKIE_SECRET
npm start
```

`GET /api/health` doit répondre `{"ok":true, ...}` une fois lancé.

## Mise en ligne (pour une classe réelle)

Le serveur a besoin de deux comptes gratuits, chacun à créer par toi (je ne peux pas les
créer à ta place) :

### 1. Neon — la base de données (persistante, gratuite)
1. Va sur [neon.tech](https://neon.tech) et crée un compte gratuit.
2. Crée un nouveau projet (n'importe quel nom, ex. « civilisation-en-classe »).
3. Dans le tableau de bord du projet, sous **Connection Details**, copie la chaîne de
   connexion (elle commence par `postgresql://...` et se termine par `?sslmode=require`).
4. Garde-la de côté — c'est la valeur de `DATABASE_URL`.

*Pourquoi Neon plutôt que la base gratuite de Render : la base Postgres gratuite de
Render s'efface automatiquement après 30 jours, ce qui perdrait les civilisations de
toute la classe en cours d'année. Neon n'a pas cette limite.*

### 2. Render — l'hébergement du serveur (gratuit)
1. Va sur [render.com](https://render.com) et crée un compte gratuit (tu peux te
   connecter avec GitHub directement).
2. Si ce n'est pas déjà fait, mets ce projet sur GitHub (dépôt privé, c'est très bien).
3. Dans Render, clique **New > Web Service**, connecte ton dépôt GitHub.
4. Configure :
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Dans l'onglet **Environment**, ajoute les variables :
   - `DATABASE_URL` = la chaîne de connexion Neon de l'étape 1
   - `COOKIE_SECRET` = une longue chaîne aléatoire (génère-la avec la commande dans
     `.env.example`)
6. Clique **Create Web Service**. Render te donnera une URL (ex.
   `https://civilisation-en-classe.onrender.com`) — c'est l'adresse du jeu.

Le service gratuit de Render se met en veille après 15 minutes d'inactivité ; la première
requête après une pause prend environ 30-60 secondes à répondre, puis tout redevient
normal. Si ça devient gênant en classe, un forfait payant (~7 $/mois) élimine cette
attente — pas nécessaire pour commencer.

## Comment le contenu du jeu est chargé

Rien n'est codé en dur : `src/content.js` lit `cartes/Arbre_Scientifique_Era1.csv`,
`Arbre_Culturel_Era1.csv`, `Unites_Era1.csv`, `Districts_Batiments.csv`,
`Cartes_Historiques_Era1.csv`, `Territoire.csv` et `Territoire_Biomes_Era1.csv` à chaque
démarrage du serveur. Ajouter ou modifier une carte, c'est donc éditer le CSV comme tu le
fais déjà pour générer les cartes imprimées, puis redéployer (ou juste redémarrer en
local) — aucune modification de code n'est nécessaire pour du contenu qui respecte les
mêmes colonnes.

## Nouveau fichier ajouté ce tour-ci

`cartes/Territoire_Biomes_Era1.csv` — les tuiles de terrain du Paléolithique/Néolithique
précoce (forêt, plaine, toundra, montagne, côtier/fluvial) que le jeu utilise pour la
carte 3x3 de départ. `Territoire.csv` existant reste tel quel (catégories PDA géographie
plus larges, pertinentes pour des ères plus tardives) ; ce nouveau fichier le complète
plutôt que de le remplacer. À réviser/ajuster si tu préfères d'autres noms ou d'autres
tuiles de départ.

## État actuel (voir aussi la liste de tâches du plan)

Fait : squelette du serveur, schéma de base de données, chargeur de contenu CSV, logique
de déblocage (prérequis), carte de départ 3x3, actions des citoyens (Chasse, Cueillir,
Tannage, Se déplacer, transformation de tuile), économie de base (achat de cartes,
production d'unités/districts), tableau de bord enseignant (API), séquence d'événements
historiques scénarisée pour les tours 1 à 8, affichage année/époque.

Pas encore fait : interface web (le frontend qui remplace/étend
`prototype/assistant-de-tour.html`), écran de tutoriel, mise en ligne réelle (attend tes
deux comptes ci-dessus).
