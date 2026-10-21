#!/usr/bin/env node
// Builds the installer on this machine with the update signature, taking the signing key from
// `.secret/` (never committed). `tauri build` needs the key because the configuration asks for
// signed update artifacts. The official releases are built by GitHub Actions instead
// (.github/workflows/release.yml); this is for trying an installer locally.
//
//   npm run build:signed -- --bundles nsis

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const keyPath = `${ROOT}.secret/updater.key`;
const passwordPath = `${ROOT}.secret/updater.password`;

if (!existsSync(keyPath)) {
  console.error(
    "Clé de signature introuvable : .secret/updater.key. Voir docs/RELEASING.md pour la générer.",
  );
  process.exit(1);
}

const env = {
  ...process.env,
  TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyPath, "utf8"),
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: existsSync(passwordPath)
    ? readFileSync(passwordPath, "utf8")
    : "",
};

const result = spawnSync("npm", ["run", "tauri", "--", "build", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: true,
});
process.exit(result.status ?? 1);
