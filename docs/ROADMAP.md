# Feuille de route

Règle : **une seule feature « EN COURS » à la fois.** On n'ouvre la suivante que lorsque la précédente est terminée (elle marche dans l'application lancée, `npm run check` passe) et que le porteur le demande. L'ordre ci-dessous est une proposition modifiable.

**Cap actuel : une application d'exercices de code, qui fonctionne très, très bien.** On apprendra aux gens à coder (cours) plus tard.

## Terminé

- [x] **0. Squelette** : projet Tauri 2 + React + TypeScript, CSP stricte, `CLAUDE.md`.
- [x] **Moteur d'exécution** : détection des outils par langage (`languages.json`), exécution surveillée (timeout, stdin, sortie plafonnée), compilation une fois puis plusieurs exécutions. Python, JavaScript, Go, Rust, C et C++ testés pour de vrai.
- [x] **Écran Environnement** : outils installés, tuto d'installation par OS.
- [x] **Éditeur Monaco** embarqué, thème clair/sombre.
- [x] **Thème et identité visuelle** (Space Mono, palette, composants néo-brutalistes).
- [x] **Recentrage sur les exercices** : liste d'exercices, énoncé + exemples, éditeur, « Tester les exemples » et « Valider », progression locale (SQLite). Les cours ont été retirés.
- [x] **Vérification anti-triche** : tests cachés tirés au hasard à chaque validation, jamais envoyés au front ; corrigés hors du binaire ; « résolu » décidé et enregistré par le Rust.
- [x] **Thème sombre repensé** : palette « crépuscule » (gris-prune chauds, rose adouci, contrastes modérés), rôles de couleur pour tous les composants, contrastes vérifiés par test, éditeur de code assorti.
- [x] **Réglages** : bouton dans la sidebar, page Apparence (thème clair/sombre mémorisé) et Environnement (déplacé depuis la sidebar).
- [x] **Authentification** : page de connexion (GitHub, Discord via Supabase, OAuth + PKCE dans le navigateur système), ouverture de l'appli sur cette page, session dans le coffre du système, déclaration d'âge, CSP durci.
- [x] **Coque et filtres** : sidebar pleine hauteur (prioritaire), navbar vide, page centrée, panneau de filtres (recherche, difficulté, langage, thème, statut) sur la liste des exercices ; logo retiré de l'interface.
- [x] **15 exercices** (Python et JavaScript) : Fibonacci, dictionnaire, liste, FizzBuzz, plus grand nombre, voyelles, palindrome, factorielle, inversion de mots, pourboires, nombres premiers, comptage de mots, doublons, rendu de monnaie, chiffre de César.
- [x] **Retour de réussite** : panneau de réussite (avancement, exercice suivant, défi autre langage), cartes résolues en vert et titre barré, cadre d'éditeur vert.
- [x] **Page d'exercice** : éditeur agrandi, panneau de filtres élargi.
- [x] **Protocoles** : section de la sidebar qui explique TCP, UDP, DNS, HTTP, TLS/SSL, HTTPS, SSH et IPC avec des schémas de séquence SVG animés (lecture automatique, pas à pas, simulation de perte de paquet). Protocoles décrits par des données.
- [x] **Protocoles présentés comme les exercices, et validés par un quiz** : cartes et panneau de filtres communs (`CatalogFilters`), validation d'un protocole seulement si les 8 questions sont justes, quiz différent à chaque essai (ordre, formulation, négation retournée, séquences à l'endroit ou à l'envers), jugé et enregistré par le Rust.
- [x] **Cours en détail des protocoles** : une leçon par sujet du quiz (faits vrais et réfutations des affirmations fausses, chronologies mot pour mot comme le quiz), pour que toute question trouve sa réponse dans le cours ; correspondance imposée par un test.
- [x] **Prérequis des protocoles** : bloc « Avant de commencer » sous le titre de chaque protocole (protocoles à connaître cliquables, validés cochés, notions de base), et une ligne sur les cartes.

- [x] **Onboarding** : questions du premier lancement (niveau, centres d'intérêt, langages connus, motivation, temps, façon d'apprendre), enregistrées par compte dans SQLite (migration v4), pour de futures recommandations. Rien ne les utilise encore.

- [x] **Versions, mises à jour et CI/CD** : versions SemVer vérifiées (5 fichiers), mise à jour automatique depuis les releases GitHub (signée, bouton visible dans la navbar), CI sur Windows et Linux, publication par tag, migrations Supabase appliquées automatiquement. Premier passage des workflows à faire sur GitHub (secrets à ajouter : `docs/RELEASING.md`).

## EN COURS

_Aucune. À choisir par le porteur._

## À venir (proposition, dans l'ordre)

- [ ] **Plus d'exercices** : en ajouter (voir « Ajouter un exercice » dans `CLAUDE.md`), des plus faciles aux plus difficiles.
- [ ] **Autres langages dans les exercices** : Go, Rust, puis C et C++ (le moteur sait déjà les exécuter).
- [ ] **Brouillons conservés** : garder le code en cours d'un exercice quand on ferme l'appli.
- [ ] **Progression liée au compte** : clé `user.id` dans `progress.db` (aujourd'hui partagée entre comptes).
- [ ] **Désactiver le fournisseur e-mail** du projet Supabase si l'appli reste OAuth uniquement (réglage du tableau de bord).

## Idées (hors périmètre, ne pas commencer)

- Publication : certificat de signature de code Windows et notarisation Apple (plus d'avertissement à la première installation), canal « bêta » qui reçoit aussi les pré-versions.
- Boutique : rendre les achats possibles (table de dépenses côté Rust, solde = gagné moins dépensé), puis les bonus et thèmes eux-mêmes. La fenêtre et le catalogue existent déjà, rien ne s'achète.
- Navbar, en haut à droite (maquettes grisées déjà posées, seul le bouton de thème marche) : recherche globale (Ctrl K), série de jours consécutifs, pièces (monnaie gagnée en résolvant, dépensée dans les bonus), bonus (menu qui regroupe ceux que le joueur gagne : double XP, gel de série...), notifications. Sidebar : sections Cours et Administration. Autres idées : objectif du jour, aide et raccourcis clavier, bouton « Continuer » vers le prochain exercice non résolu.
- Cours et parcours d'apprentissage, indices progressifs, révision espacée SM-2, badges, séries, classement, protocoles en plus (WebSocket, SMTP, FTP, QUIC...), quiz sur les protocoles.
