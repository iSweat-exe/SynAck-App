# Publier une version de SynAck

Comment une version part de ton ordinateur jusqu'aux applications installées, et ce qu'il faut
configurer une seule fois sur GitHub.

## Vue d'ensemble

```
tu changes la version (SemVer) et le CHANGELOG
        │   git tag vX.Y.Z  +  git push origin vX.Y.Z
        ▼
GitHub Actions « Release »
   1. vérifie : le tag est sur main, les 5 fichiers de version sont d'accord, le CHANGELOG a des notes
   2. construit les installeurs : Windows (.exe), macOS (Intel + Apple silicon), Linux (.deb, .AppImage)
   3. signe les fichiers de mise à jour avec la clé Tauri (secret GitHub)
   4. crée la release (brouillon), y met un `latest.json`, puis la publie quand tout est prêt
        ▼
les applications installées lisent
https://github.com/iSweat-exe/SynAck-App/releases/latest/download/latest.json
        ▼
un bouton « Mettre à jour vX.Y.Z » rose apparaît dans la navbar ; un clic télécharge, vérifie la
signature, installe, puis propose de redémarrer
```

Rien n'est téléchargé ni redémarré sans un clic de l'élève. L'application cherche toute seule 5
secondes après le lancement, puis toutes les 6 heures (jamais en `npm run dev`).

## À faire une seule fois

### 1. Les secrets GitHub

Dépôt GitHub > **Settings > Secrets and variables > Actions**. Tu es déjà connecté à `gh` : les
commandes ci-dessous lisent les fichiers de `.secret/` **sans que tu aies à copier-coller** quoi que
ce soit.

| Nom                                  | Type     | Valeur                                                                             | Sert à                     |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------- | -------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | secret   | le contenu de `.secret/updater.key`                                                | signer les mises à jour    |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | secret   | le contenu de `.secret/updater.password`                                           | déverrouiller la clé       |
| `SUPABASE_ACCESS_TOKEN`              | secret   | un jeton créé sur https://supabase.com/dashboard/account/tokens                    | appliquer les migrations   |
| `SUPABASE_DB_PASSWORD`               | secret   | le mot de passe de la base (Supabase > Project Settings > Database)                | appliquer les migrations   |
| `SUPABASE_PROJECT_REF`               | variable | `rbsocqtdggvrkhneduan` (l'identifiant qui est dans l'URL du projet, il est public) | choisir le projet à migrer |

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo iSweat-exe/SynAck-App < .secret/updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo iSweat-exe/SynAck-App < .secret/updater.password
gh secret set SUPABASE_ACCESS_TOKEN --repo iSweat-exe/SynAck-App
gh secret set SUPABASE_DB_PASSWORD --repo iSweat-exe/SynAck-App
gh variable set SUPABASE_PROJECT_REF --repo iSweat-exe/SynAck-App --body rbsocqtdggvrkhneduan
```

Les deux dernières secrets (`gh secret set` sans `<`) te demandent la valeur au clavier : elle ne
reste ni dans l'historique du terminal ni dans un fichier.

Le job de migration tourne dans l'environnement GitHub `production`. S'il n'existe pas, GitHub le
crée au premier passage. Tu peux l'ouvrir (**Settings > Environments > production**) pour exiger ton
approbation avant chaque migration en production, ce que je te conseille.

### 2. Le reste côté GitHub

- **Branche par défaut : `main`.** Les workflows écoutent `main`. Le premier `git push` doit
  envoyer `main` (la branche locale a été renommée `main`).
- **Protection de `main`** (Settings > Branches) : exiger la vérification **CI gate**.
- **Étiquette `breaking-change`** (utilisée par le garde-fou des migrations) :
  `gh label create breaking-change --repo iSweat-exe/SynAck-App --color d73a4a`
- **Actions > General > Workflow permissions** : « Read repository contents » suffit, la release
  demande elle-même `contents: write`.

### 3. Les clés de signature (`.secret/`)

Déjà générées. `.secret/` est dans `.gitignore` et n'est **jamais** commité :

| Fichier                    | Rôle                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `.secret/updater.key`      | clé **privée** : signe les mises à jour. Ne la donne à personne. |
| `.secret/updater.password` | son mot de passe                                                 |
| `.secret/updater.key.pub`  | clé publique, déjà copiée dans `tauri.conf.json` (`pubkey`)      |

> **Sauvegarde `.secret/` dans un gestionnaire de mots de passe.** Si la clé privée est perdue, les
> applications déjà installées ne pourront plus vérifier une mise à jour : il faudrait que chaque
> élève réinstalle l'application à la main. Changer de clé revient au même.

## Publier une version

Le numéro suit le [versionnage sémantique](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.PATCH`.

- **PATCH** (`0.1.0` → `0.1.1`) : une correction, rien de nouveau.
- **MINEUR** (`0.1.0` → `0.2.0`) : une nouveauté. Tant que la version commence par `0.`, un
  changement qui casse quelque chose passe aussi par le mineur.
- **MAJEUR** (`0.x` → `1.0.0`) : la sortie de la pré-alpha, puis un changement qui casse.
- **Pré-version** (`0.2.0-alpha.1`, `-beta.1`, `-rc.1`) : publiée comme « pre-release » sur GitHub.
  Les applications installées ne la reçoivent **pas** (elles ne suivent que la dernière release
  stable) : utile pour la tester à la main.

Étapes :

1. Dans `CHANGELOG.md`, déplace ce qui est sous `## [Unreleased]` dans une nouvelle section
   `## [X.Y.Z] - AAAA-MM-JJ`. Écris-la **pour les élèves** : elle est affichée dans l'application.
2. Change la version partout d'un coup :
   ```bash
   npm run version:set -- X.Y.Z
   ```
   (`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`,
   `src-tauri/tauri.conf.json`.) `npm run check` refuse des versions qui ne sont pas identiques.
3. `npm run check`, puis commit `chore: release vX.Y.Z` et merge dans `main`.
4. Le tag, **sur `main`** :
   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
5. Regarde l'onglet **Actions** : « Release » construit les 4 installeurs (environ 20 à 30
   minutes), puis publie. Vérifie que la release contient bien `latest.json`.

Si une étape échoue, rien n'est publié : la release reste un brouillon. Corrige, supprime le brouillon
et le tag (`git push --delete origin vX.Y.Z`), puis recommence.

## Essayer un installeur sur ton ordinateur

```bash
npm run build:signed -- --bundles nsis
```

Lit la clé dans `.secret/`. L'installeur est dans `src-tauri/target/release/bundle/nsis/`, avec son
fichier `.sig`.

## Les migrations Supabase

Le projet Supabase est partagé avec l'ancienne version web. Ses migrations sont maintenant dans
`supabase/migrations/` ici (copiées telles quelles de l'ancien dépôt, historique identique).

- **Sur une pull request qui touche `supabase/`** : les règles sont vérifiées (une migration déjà
  appliquée ne se modifie jamais, une nouvelle doit être plus récente que la dernière de `main`, un
  `drop`/`truncate`/`delete from` demande l'étiquette `breaking-change`), puis toutes les migrations
  sont rejouées sur une base locale jetable et les tests (`supabase/tests/`) tournent.
- **Au merge dans `main`** d'une nouvelle migration : essai à blanc, application sur la production,
  puis vérification que rien n'est resté en attente.
- **À la main** (Actions > Database > Run workflow) : essai à blanc par défaut.

Créer une migration : `supabase migration new nom_de_la_migration`, écris le SQL, ouvre une pull
request.

> **Arrête le vieux déploiement.** L'ancien dépôt `SynAck` a son propre workflow `db-migrate.yml`
> qui pousse sur le même projet. Désactive-le (ou archive l'ancien dépôt) pour qu'une seule source de
> vérité applique les migrations.

> **Réglage manuel, une seule fois.** Dans Supabase > Authentication > URL Configuration, l'URL
> `http://127.0.0.1:53682/callback` doit figurer dans les Redirect URLs : c'est là que revient la
> connexion GitHub/Discord de l'application. Les migrations ne le changent pas.

## Limites à connaître

- Les installeurs ne sont **pas signés avec un certificat de développeur** (Windows) ni notarisés
  (Apple). Les mises à jour, elles, sont bien vérifiées avec la clé Tauri. Mais Windows SmartScreen
  et macOS Gatekeeper afficheront un avertissement à la **première installation** à la main.
- Windows : l'installeur est NSIS seulement (le format MSI refuse les pré-versions avec lettres).
- Je n'ai pas pu lancer les workflows moi-même : ils tourneront pour la première fois sur GitHub.
  Le premier passage de la CI peut demander un ajustement.
