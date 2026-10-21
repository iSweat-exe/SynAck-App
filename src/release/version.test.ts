import { describe, expect, it } from "vitest";
import {
  changelogNotes,
  isPrerelease,
  isSemver,
  readVersions,
  versionOfTag,
  versionProblems,
  withVersion,
  type VersionFile,
  type Versions,
} from "./version";

const FILES: Record<VersionFile, string> = {
  "package.json": '{\n  "name": "synack",\n  "version": "1.2.3"\n}\n',
  "package-lock.json":
    '{\n  "name": "synack",\n  "version": "1.2.3",\n  "packages": {\n    "": { "name": "synack", "version": "1.2.3" }\n  }\n}\n',
  "src-tauri/Cargo.toml":
    '[package]\nname = "synack"\nversion = "1.2.3"\nedition = "2024"\n\n[dependencies]\nserde = { version = "1" }\n',
  "src-tauri/Cargo.lock":
    '[[package]]\nname = "other"\nversion = "9.9.9"\n\n[[package]]\nname = "synack"\nversion = "1.2.3"\n',
  "src-tauri/tauri.conf.json": '{\n  "productName": "SynAck",\n  "version": "1.2.3"\n}\n',
};

const SAME: Versions = readVersions(FILES, "synack");

describe("isSemver", () => {
  it.each(["0.1.0", "1.2.3", "10.20.30", "1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-0.3.7"])(
    "should accept %s",
    (version) => {
      expect(isSemver(version)).toBe(true);
    },
  );

  it.each(["1", "1.2", "01.2.3", "1.2.3.4", "v1.2.3", "1.2.3-", "1.2.3-01", "1.2.3+build", ""])(
    "should refuse %s",
    (version) => {
      expect(isSemver(version)).toBe(false);
    },
  );
});

describe("isPrerelease", () => {
  it("should be true with a suffix", () => {
    expect(isPrerelease("1.0.0-beta.2")).toBe(true);
  });

  it("should be false for a stable version", () => {
    expect(isPrerelease("1.0.0")).toBe(false);
  });
});

describe("versionOfTag", () => {
  it("should drop the v of a release tag", () => {
    expect(versionOfTag("v1.2.3")).toBe("1.2.3");
  });

  it("should keep a pre-release suffix", () => {
    expect(versionOfTag("v1.2.3-rc.1")).toBe("1.2.3-rc.1");
  });

  it("should refuse a tag without the v", () => {
    expect(versionOfTag("1.2.3")).toBeNull();
  });

  it("should refuse a tag that is not a version", () => {
    expect(versionOfTag("vnext")).toBeNull();
  });
});

describe("readVersions", () => {
  it("should read the version of every file", () => {
    expect(Object.values(SAME)).toEqual(["1.2.3", "1.2.3", "1.2.3", "1.2.3", "1.2.3"]);
  });

  it("should read the crate of the lockfile, not another one", () => {
    expect(readVersions(FILES, "other")["src-tauri/Cargo.lock"]).toBe("9.9.9");
  });

  it("should not take the version of a dependency for the one of the package", () => {
    const files = {
      ...FILES,
      "src-tauri/Cargo.toml": '[package]\nname = "a"\n\n[dependencies]\nx = { version = "5" }\n',
    };
    expect(readVersions(files, "synack")["src-tauri/Cargo.toml"]).toBeNull();
  });
});

describe("versionProblems", () => {
  it("should find nothing when the versions agree", () => {
    expect(versionProblems(SAME)).toEqual([]);
  });

  it("should say when one file is behind", () => {
    const behind: Versions = { ...SAME, "src-tauri/Cargo.toml": "1.2.2" };
    expect(versionProblems(behind).join(" ")).toContain("pas identiques");
  });

  it("should refuse a version that is not SemVer", () => {
    const wrong: Versions = {
      "package.json": "1.2",
      "package-lock.json": "1.2",
      "src-tauri/Cargo.toml": "1.2",
      "src-tauri/Cargo.lock": "1.2",
      "src-tauri/tauri.conf.json": "1.2",
    };
    expect(versionProblems(wrong).join(" ")).toContain("SemVer");
  });

  it("should say when a file has no version", () => {
    expect(versionProblems({ ...SAME, "package.json": null }).join(" ")).toContain("introuvable");
  });

  it("should accept a tag that names the version", () => {
    expect(versionProblems(SAME, "v1.2.3")).toEqual([]);
  });

  it("should refuse a tag that names another version", () => {
    expect(versionProblems(SAME, "v1.2.4").join(" ")).toContain("ne correspond pas");
  });

  it("should refuse a tag that is not a version", () => {
    expect(versionProblems(SAME, "latest").join(" ")).toContain("n'est pas de la forme");
  });
});

describe("withVersion", () => {
  it("should change the version in every file and nothing else", () => {
    const next = Object.fromEntries(
      (Object.keys(FILES) as VersionFile[]).map((file) => [
        file,
        withVersion(file, FILES[file], "2.0.0-beta.1", "synack"),
      ]),
    ) as Record<VersionFile, string>;
    expect(Object.values(readVersions(next, "synack"))).toEqual(Array(5).fill("2.0.0-beta.1"));
  });

  it("should leave the version of a dependency alone", () => {
    const toml = withVersion(
      "src-tauri/Cargo.toml",
      FILES["src-tauri/Cargo.toml"],
      "3.0.0",
      "synack",
    );
    expect(toml).toContain('serde = { version = "1" }');
  });

  it("should leave the other crates of the lockfile alone", () => {
    const lock = withVersion(
      "src-tauri/Cargo.lock",
      FILES["src-tauri/Cargo.lock"],
      "3.0.0",
      "synack",
    );
    expect(lock).toContain('name = "other"\nversion = "9.9.9"');
  });
});

describe("changelogNotes", () => {
  const changelog = [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "## [0.2.0] - 2026-11-01",
    "",
    "### Added",
    "- A thing.",
    "",
    "## [0.1.0] - 2026-10-21",
    "",
    "- First.",
  ].join("\n");

  it("should return the section of a version", () => {
    expect(changelogNotes(changelog, "0.2.0")).toBe("### Added\n- A thing.");
  });

  it("should stop at the next version", () => {
    expect(changelogNotes(changelog, "0.1.0")).toBe("- First.");
  });

  it("should be null for a version with no section", () => {
    expect(changelogNotes(changelog, "9.9.9")).toBeNull();
  });

  it("should be null for an empty section", () => {
    expect(changelogNotes(changelog, "Unreleased")).toBeNull();
  });
});
