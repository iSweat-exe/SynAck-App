/// <reference types="node" />
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterItems, NO_FILTER, type Browsable } from "../exercises/filter";
import { PROTOCOLS } from "./catalog";

const ITEMS: Browsable[] = PROTOCOLS.map((protocol) => ({
  id: protocol.id,
  title: `${protocol.name} ${protocol.fullName}`,
  summary: protocol.tagline,
  topics: protocol.topics,
  difficulty: protocol.difficulty,
}));

const ids = (criteria: Partial<typeof NO_FILTER>, done: string[] = []) =>
  filterItems(ITEMS, new Set(done), { ...NO_FILTER, ...criteria }).map((item) => item.id);

describe("browsing the protocols", () => {
  it("shows every protocol when nothing is asked", () => {
    expect(ids({})).toHaveLength(PROTOCOLS.length);
  });

  it("finds a protocol by its full name, without caring for case or accents", () => {
    expect(ids({ query: "TRANSMISSION control" })).toEqual(["tcp"]);
    expect(ids({ query: "securite" })).toContain("tls");
  });

  it("keeps the protocols of a theme", () => {
    const security = ids({ topics: ["Sécurité"] });
    expect(security).toEqual(expect.arrayContaining(["tls", "https", "ssh"]));
    expect(security).not.toContain("udp");
  });

  it("keeps the protocols of a difficulty", () => {
    for (const id of ids({ difficulties: ["hard"] })) {
      expect(PROTOCOLS.find((protocol) => protocol.id === id)?.difficulty).toBe("hard");
    }
  });

  it("separates the validated protocols from those still to validate", () => {
    expect(ids({ status: "solved" }, ["dns"])).toEqual(["dns"]);
    expect(ids({ status: "todo" }, ["dns"])).not.toContain("dns");
  });

  it("ignores the language group, which protocols do not have", () => {
    expect(ids({ languages: ["python"] })).toHaveLength(0);
  });
});

describe("the protocols and their quiz", () => {
  it("have a bank of questions in the Rust side for every protocol, and no other", () => {
    const banks = readdirSync(new URL("../../src-tauri/protocols", import.meta.url))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(".json", ""))
      .sort();
    expect(PROTOCOLS.map((protocol) => protocol.id).sort()).toEqual(banks);
  });
});
