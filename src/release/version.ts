/*
 * The version of the application, written in five files that must say the same thing. This is the
 * logic of `scripts/version.mjs`, kept here so that it is typed and tested. The version follows
 * Semantic Versioning (https://semver.org): MAJOR.MINOR.PATCH, with an optional pre-release suffix.
 */

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

/** Whether this is a valid SemVer version, without a `v` prefix and without build metadata. */
export function isSemver(version: string): boolean {
  return SEMVER.test(version);
}

/** Whether this version is a pre-release (`1.2.0-beta.1`): it is published as one on GitHub. */
export function isPrerelease(version: string): boolean {
  return SEMVER.exec(version)?.[4] !== undefined;
}

/** The version a release tag names: `v1.2.3` gives `1.2.3`. Anything else is not a release tag. */
export function versionOfTag(tag: string): string | null {
  const version = tag.startsWith("v") ? tag.slice(1) : null;
  return version !== null && isSemver(version) ? version : null;
}

/** The files that carry the version, in the order they are reported. */
export const VERSION_FILES = [
  "package.json",
  "package-lock.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
] as const;

export type VersionFile = (typeof VERSION_FILES)[number];

/** The version found in each file, or `null` where it could not be read. */
export type Versions = Record<VersionFile, string | null>;

function jsonVersion(text: string): string | null {
  const data: unknown = JSON.parse(text);
  if (typeof data !== "object" || data === null || !("version" in data)) return null;
  return typeof data.version === "string" ? data.version : null;
}

/** The version of the `[package]` table of a Cargo manifest. */
function cargoTomlVersion(text: string): string | null {
  const table = /\[package\]([\s\S]*?)(?:\n\[|$)/.exec(text)?.[1];
  return table === undefined ? null : (/^version\s*=\s*"([^"]+)"/m.exec(table)?.[1] ?? null);
}

/** The version recorded for one crate in `Cargo.lock`. */
function cargoLockVersion(text: string, crate: string): string | null {
  const pattern = new RegExp(`\\[\\[package\\]\\]\\nname = "${crate}"\\nversion = "([^"]+)"`);
  return pattern.exec(text)?.[1] ?? null;
}

function lockfileVersion(text: string): string | null {
  const data: unknown = JSON.parse(text);
  if (typeof data !== "object" || data === null || !("packages" in data)) return null;
  const root = (data.packages as Record<string, unknown> | undefined)?.[""];
  if (typeof root !== "object" || root === null || !("version" in root)) return null;
  return typeof root.version === "string" ? root.version : null;
}

/** Reads the version out of the text of each file. */
export function readVersions(files: Record<VersionFile, string>, crate: string): Versions {
  return {
    "package.json": jsonVersion(files["package.json"]),
    "package-lock.json": lockfileVersion(files["package-lock.json"]),
    "src-tauri/Cargo.toml": cargoTomlVersion(files["src-tauri/Cargo.toml"]),
    "src-tauri/Cargo.lock": cargoLockVersion(files["src-tauri/Cargo.lock"], crate),
    "src-tauri/tauri.conf.json": jsonVersion(files["src-tauri/tauri.conf.json"]),
  };
}

/** What is wrong with the versions, in words. Empty when they agree and are valid SemVer. */
export function versionProblems(versions: Versions, tag?: string): string[] {
  const problems: string[] = [];
  for (const file of VERSION_FILES) {
    const version = versions[file];
    if (version === null) problems.push(`${file} : version introuvable.`);
    else if (!isSemver(version)) problems.push(`${file} : « ${version} » n'est pas du SemVer.`);
  }
  const found = new Set(Object.values(versions).filter((version) => version !== null));
  if (found.size > 1) {
    problems.push(
      `Les versions ne sont pas identiques : ${VERSION_FILES.map((file) => `${file} = ${versions[file] ?? "?"}`).join(", ")}.`,
    );
  }
  if (tag !== undefined) {
    const expected = versionOfTag(tag);
    if (expected === null)
      problems.push(`Le tag « ${tag} » n'est pas de la forme vMAJEUR.MINEUR.PATCH.`);
    else if (found.size === 1 && !found.has(expected)) {
      problems.push(`Le tag ${tag} ne correspond pas à la version de l'application.`);
    }
  }
  return problems;
}

/** Writes a new version into the text of one file. Everything else in the file is left alone. */
export function withVersion(
  file: VersionFile,
  text: string,
  version: string,
  crate: string,
): string {
  switch (file) {
    case "package.json":
    case "src-tauri/tauri.conf.json":
      return JSON.stringify({ ...(JSON.parse(text) as object), version }, null, 2) + "\n";
    case "package-lock.json": {
      const data = JSON.parse(text) as {
        version?: string;
        packages?: Record<string, { version?: string }>;
      };
      data.version = version;
      const root = data.packages?.[""];
      if (root) root.version = version;
      return JSON.stringify(data, null, 2) + "\n";
    }
    case "src-tauri/Cargo.toml":
      return text.replace(
        /(\[package\][\s\S]*?\nversion\s*=\s*)"[^"]+"/,
        (_match, head: string) => `${head}"${version}"`,
      );
    case "src-tauri/Cargo.lock":
      return text.replace(
        new RegExp(`(\\[\\[package\\]\\]\\nname = "${crate}"\\nversion = )"[^"]+"`),
        (_match, head: string) => `${head}"${version}"`,
      );
  }
}

/**
 * The notes of one version in a Keep a Changelog file: what sits under its `## [x.y.z]` heading,
 * up to the next heading. `null` when the version has no section or the section is empty.
 */
export function changelogNotes(changelog: string, version: string): string | null {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const notes = (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
  return notes === "" ? null : notes;
}
