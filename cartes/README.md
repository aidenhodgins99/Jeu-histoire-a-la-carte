# Banque de cartes — dossier `cartes/`

## Ce que c'est
Ce dossier remplace `banque_cartes.xlsx` de l'ancienne conversation (perdu — il vivait dans
l'environnement temporaire de cette autre session et n'a jamais été livré dans ce projet). Comme
Python/Node/une extension Excel ne sont pas installés dans cet environnement, le contenu est en
**CSV** (un fichier = un onglet) plutôt qu'un vrai `.xlsx` — chaque fichier s'ouvre directement dans
Excel ou Google Sheets exactement de la même façon.

## Fichiers
- `Arbre_Scientifique_Era1.csv` — arbre technologique complet, Paléolithique/Néolithique
- `Arbre_Culturel_Era1.csv` — arbre culturel/croyance/gouvernance, Paléolithique/Néolithique
- `Unites_Era1.csv` — unités jouables de l'Ère 1
- `Districts_Batiments.csv` — les 8 quartiers et leurs bâtiments (plusieurs se débloquent après l'Ère 1, c'est noté)
- `Cartes_Historiques_Era1.csv` — les 9 cartes événement de l'Ère 1 (7 d'origine + 2 nouvelles ajoutées
  une fois les vrais documents de classe disponibles), avec lien PDA explicite
- `Territoire.csv` — cartes territoire (géographie), *territoire autochtone volontairement absente — voir la note dans le fichier*
- `Territoire_Biomes_Era1.csv` — **nouveau**, ajouté pendant la construction du serveur/jeu en ligne :
  les tuiles de terrain paléolithique/néolithique précoce (forêt, plaine, toundra, montagne,
  côtier/fluvial) que la carte 3x3 de départ utilise. Distinct de `Territoire.csv` (catégories PDA
  géographie plus larges, pertinentes pour des ères plus tardives). À faire : dessiner de vraies
  cartes imprimables pour ces 5 tuiles (même gabarit que les autres cartes territoire) et, une fois
  que les deux fichiers sont bien remplis, décider s'ils doivent fusionner en un seul arbre territoire
  ou rester deux familles séparées (biomes de départ vs catégories géographiques PDA).
- `Chapitre2_Mesopotamie.csv` — contenu réel (non-brouillon) du chapitre 2, construit à partir du
  résumé officiel, du test de connaissances et de l'évaluation de compétences que tu as envoyés

## Sources utilisées
- Les deux glossaires initiaux (*Complètement CHRONO !*, TC Média Livres) : Glossaire-index 1
  « La sédentarisation » et Glossaire-index 2 « La naissance d'une civilisation ».
- Les documents envoyés ensuite pour les chapitres 1 et 2 : les deux **Résumés**, les deux **Tests de
  connaissances**, les deux **Évaluations des compétences**, et les deux **Activités
  supplémentaires** — tous entièrement lus et intégrés. Ils confirment presque mot pour mot les choix
  déjà faits dans `Arbre_Scientifique_Era1.csv`/`Arbre_Culturel_Era1.csv` (agriculture → surplus →
  artisanat/division du travail → troc → propriété → fortifications → hiérarchie sociale) et ont
  fourni de vraies dates, de vrais sites archéologiques (Jéricho, Çatal Höyük v. 6500 av. J.-C., Aïn
  Ghazal, Jerf el Ahmar) et de vrais personnages historiques pour le chapitre 2 (Gudéa de Lagash,
  Hammurabi, Sargon II, Assurbanipal). Chaque fait porte sa source exacte dans la colonne Source.
- Pour les notions qui ne sont dans aucun document reçu (ex. Feu, Chasse, Lance — des bases
  paléolithiques générales, pas propres au manuel), j'ai utilisé des connaissances générales,
  clairement marquées « Connaissances générales — hors glossaire ».
- Les coûts en points (Science/Culture/Production) restent des **brouillons non testés** — l'ancien
  simulateur de rythme (fichier Excel) qui validait ces chiffres n'est pas récupérable. Il faudra le
  reconstruire une fois qu'on a une vraie séance de jeu à observer.

## Contenu déjà extrait mais pas encore intégré aux cartes
Les 11 dossiers **« Ailleurs »** que tu as envoyés (Égypte, Indus, Chine, Sparte, Perse, Han, Gupta,
Islam, Constantinople, Bagdad, Tombouctou — 22 fichiers avec corrigés) sont déjà convertis en texte et
sauvegardés localement, mais je ne les ai pas encore dépouillés pour en tirer des cartes — ce sera la
prochaine étape logique pour construire les chapitres 3 à 6. Dis-moi quand tu veux qu'on les traite.

## Ce qui bloque encore (besoin de toi)
1. **Images** — sur les 8 fichiers dans `Pictures/L'histoire a travers les civilisations/`, seul
   `metallurgie.png` s'est ouvert correctement chez moi, et c'est une photo Alamy/North Wind Picture
   Archives (payante) — pas utilisable telle quelle dans du matériel imprimé/distribué sans licence.
   Les 3 fichiers `.avif` et 2 fichiers `.webp` ne sont pas lisibles par mes outils (format non
   supporté ici). Les 2 PNG restants (`peintures rupestres.png` et `description des principales
   innovations...png`) s'ouvrent mais apparaissent blancs chez moi malgré une taille de fichier
   normale — possible export raté. **Pour débloquer :** réexporte ces 7 images en PNG ou JPG standard
   (pas avif/webp), et confirme si tu as les droits de réutilisation pour l'image Alamy ou si on la
   remplace par une source libre. (Note technique : j'ai maintenant installé un outil de conversion
   d'images — poppler — pour les PDF, mais ça ne convertit pas l'avif/webp ; il faudrait un outil
   différent, à installer seulement si tu veux que je m'en occupe.)
2. **La frise chronologique interactive** (iplusinteractif.com) — le lien a été refusé par mon
   navigateur (accès bloqué). Si tu veux que je m'en serve pour les dates précises, une capture
   d'écran ou un export du contenu serait plus fiable qu'un lien.
3. **maZoneCEC** (mazonececdemo.com/application/bookshelf) — redirige vers une vraie page de connexion
   (mazonecec.com). Je ne peux pas m'y connecter avec tes identifiants (je ne dois jamais saisir de
   mot de passe à ta place, même si tu me les donnes). Si tu veux que ce contenu nourrisse les cartes,
   connecte-toi toi-même et exporte/copie-colle le contenu pertinent ici.

## Comment éditer
Ouvre un fichier CSV dans Excel/Google Sheets, modifie les cellules, renvoie-le-moi (ou dis-moi
directement les changements) — même flux que l'ancien `banque_cartes.xlsx`. Une fois qu'on a une
vraie chaîne de génération de PDF (voir le pipeline mentionné dans `GAME_DESIGN_BRIEF.md`), ces
fichiers deviendront la source de vérité pour produire les planches de cartes imprimables.
