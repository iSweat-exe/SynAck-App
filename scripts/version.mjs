#!/usr/bin/env node
// The version of the application: read it, check that every file agrees, change it, or print the
// notes of a version. The logic lives in `src/release/version.ts` (typed and tested); this is only
// the command line around it. Node runs the TypeScript file directly (Node 22.18 or later).
//
//   node scripts/version.mjs current              the version, nothing else
//   node scripts/version.mjs check [--tag v1.2.3] fails if the files disagree or are not SemVer
//   node scripts/version.mjs set 1.2.3            writes the version in the five files
//   node scripts/version.mjs notes 1.2.3          the CHANGELOG.md section of this version

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  VERSION_FILES,
  changelogNotes,
  isSemver,
  readVersions,
  versionProblems,
  withVersion,
} from "../src/release/version.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CRATE = "synack";

const read = (file) => readFileSync(new URL(file, `file://${ROOT.replace(/\\/g, "/")}/`), "utf8");
const write = (file, text) =>
  writeFileSync(new URL(file, `file://${ROOT.replace(/\\/g, "/")}/`), text);

function loadVersions() {
  const files = Object.fromEntries(VERSION_FILES.map((file) => [file, read(file)]));
  return readVersions(files, CRATE);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);

if (command === "current") {
  const version = loadVersions()["package.json"];
  if (version === null) fail("package.json : version introuvable.");
  console.log(version);
} else if (command === "check") {
  const tagAt = args.indexOf("--tag");
  const tag = tagAt >= 0 ? args[tagAt + 1] : undefined;
  const versions = loadVersions();
  const problems = versionProblems(versions, tag);
  if (problems.length > 0) fail(problems.join("\n"));
  console.log(
    `Version ${versions["package.json"]} : les ${VERSION_FILES.length} fichiers sont d'accord.`,
  );
} else if (command === "set") {
  const version = args[0];
  if (version === undefined || !isSemver(version)) {
    fail("Usage : node scripts/version.mjs set MAJEUR.MINEUR.PATCH[-préversion]");
  }
  for (const file of VERSION_FILES) write(file, withVersion(file, read(file), version, CRATE));
  const problems = versionProblems(loadVersions());
  if (problems.length > 0) fail(problems.join("\n"));
  console.log(`Version ${version} écrite dans : ${VERSION_FILES.join(", ")}.`);
} else if (command === "notes") {
  const version = args[0];
  if (version === undefined) fail("Usage : node scripts/version.mjs notes MAJEUR.MINEUR.PATCH");
  const notes = changelogNotes(read("CHANGELOG.md"), version);
  if (notes === null) fail(`CHANGELOG.md : aucune note pour la version ${version}.`);
  console.log(notes);
} else {
  fail("Commandes : current, check [--tag vX.Y.Z], set X.Y.Z, notes X.Y.Z");
}
