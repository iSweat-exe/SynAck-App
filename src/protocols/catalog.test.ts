import { describe, expect, it } from "vitest";
import { PROTOCOLS, findProtocol } from "./catalog";
import { labelFits, layoutDiagram } from "./layout";
import { buildTimeline } from "./timeline";

/** The content of every protocol is data: these tests catch the mistakes a typo would make. */

describe.each(PROTOCOLS.map((protocol) => [protocol.id, protocol] as const))(
  "%s",
  (_id, protocol) => {
    const actorIds = protocol.actors.map((actor) => actor.id);

    it("has everything the page shows", () => {
      expect(protocol.purpose.length).toBeGreaterThan(0);
      expect(protocol.takeaways.length).toBeGreaterThan(0);
      expect(protocol.facts.length).toBeGreaterThan(0);
      expect(protocol.steps.length).toBeGreaterThan(0);
    });

    it("has at least two actors, with different ids", () => {
      expect(protocol.actors.length).toBeGreaterThanOrEqual(2);
      expect(new Set(actorIds).size).toBe(actorIds.length);
    });

    it("only makes known actors talk", () => {
      for (const step of protocol.steps) {
        expect(actorIds).toContain(step.from);
        expect(actorIds).toContain(step.to);
      }
    });

    it("only sets the state of known actors", () => {
      for (const step of protocol.steps) {
        for (const id of Object.keys(step.states ?? {})) expect(actorIds).toContain(id);
      }
    });

    it("explains every step", () => {
      for (const step of protocol.steps) {
        expect(step.label.trim()).not.toBe("");
        expect(step.note.trim()).not.toBe("");
      }
    });

    it("links only to protocols that exist, and not to itself", () => {
      for (const id of protocol.related) {
        expect(findProtocol(id)).toBeDefined();
        expect(id).not.toBe(protocol.id);
      }
    });

    it("only asks for prerequisites that exist, that come earlier in the catalog, and never itself", () => {
      const position = (id: string) => PROTOCOLS.findIndex((candidate) => candidate.id === id);
      for (const id of protocol.prerequisites) {
        expect(findProtocol(id), id).toBeDefined();
        expect(position(id), `${id} doit venir avant ${protocol.id}`).toBeLessThan(
          position(protocol.id),
        );
      }
    });

    it("lists each prerequisite once", () => {
      expect(new Set(protocol.prerequisites).size).toBe(protocol.prerequisites.length);
      expect(new Set(protocol.notions).size).toBe(protocol.notions.length);
    });

    it.each([false, true])(
      "writes every label where it fits (loss simulated: %s)",
      (simulateLoss) => {
        const timeline = buildTimeline(protocol.steps, simulateLoss);
        const { rows, spacing } = layoutDiagram(protocol.actors, timeline);
        timeline.forEach((step, index) => {
          const row = rows[index];
          if (row === undefined) throw new Error("row missing");
          expect(labelFits(row, step.label, spacing), `« ${step.label} » est trop long`).toBe(true);
        });
      },
    );

    it("explains each of the three moments of a lost packet", () => {
      for (const step of protocol.steps) {
        if (!step.loss) continue;
        expect(step.loss.lost.trim()).not.toBe("");
        expect(step.loss.wait.trim()).not.toBe("");
        expect(step.loss.retry.trim()).not.toBe("");
      }
    });

    it("only lets a message be lost when it travels between two actors", () => {
      for (const step of protocol.steps) {
        if (step.loss) expect(step.from).not.toBe(step.to);
      }
    });
  },
);

describe("the catalog", () => {
  it("gives every protocol its own id", () => {
    const ids = PROTOCOLS.map((protocol) => protocol.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the protocols that were asked for", () => {
    const ids = PROTOCOLS.map((protocol) => protocol.id);
    for (const wanted of ["http", "https", "ssh", "tls", "dns", "tcp", "ipc"]) {
      expect(ids).toContain(wanted);
    }
  });

  it("finds a protocol by its id, and nothing for an unknown id", () => {
    expect(findProtocol("dns")?.name).toBe("DNS");
    expect(findProtocol("nope")).toBeUndefined();
  });
});
