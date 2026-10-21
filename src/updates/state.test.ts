import { describe, expect, it } from "vitest";
import { INITIAL, percent, reduce, type UpdateState } from "./state";

const FOUND = { version: "0.2.0", notes: "Du nouveau." };

function run(events: Parameters<typeof reduce>[1][], from: UpdateState = INITIAL): UpdateState {
  return events.reduce(reduce, from);
}

describe("reduce", () => {
  it("should be checking once a check starts", () => {
    expect(run([{ type: "checkStarted" }]).status).toBe("checking");
  });

  it("should be up to date when the check finds nothing", () => {
    expect(run([{ type: "checkStarted" }, { type: "checkFinished", update: null }]).status).toBe(
      "upToDate",
    );
  });

  it("should offer the update the check found", () => {
    expect(run([{ type: "checkStarted" }, { type: "checkFinished", update: FOUND }])).toEqual({
      status: "available",
      version: "0.2.0",
      notes: "Du nouveau.",
    });
  });

  it("should ignore a check result nobody is waiting for", () => {
    expect(run([{ type: "checkFinished", update: FOUND }]).status).toBe("idle");
  });

  it("should start downloading from an available update", () => {
    const state = run([
      { type: "checkStarted" },
      { type: "checkFinished", update: FOUND },
      { type: "downloadStarted" },
    ]);
    expect(state.status).toBe("downloading");
  });

  it("should not start downloading when there is nothing to download", () => {
    expect(run([{ type: "downloadStarted" }]).status).toBe("idle");
  });

  it("should add up the chunks of a download", () => {
    const state = run([
      { type: "checkStarted" },
      { type: "checkFinished", update: FOUND },
      { type: "downloadStarted" },
      { type: "progress", progress: { kind: "started", total: 1000 } },
      { type: "progress", progress: { kind: "chunk", bytes: 250 } },
      { type: "progress", progress: { kind: "chunk", bytes: 250 } },
    ]);
    expect(state).toMatchObject({ status: "downloading", downloaded: 500, total: 1000 });
  });

  it("should be ready for the restart once installed", () => {
    const state = run([
      { type: "checkStarted" },
      { type: "checkFinished", update: FOUND },
      { type: "downloadStarted" },
      { type: "installed" },
    ]);
    expect(state).toEqual({ status: "ready", version: "0.2.0" });
  });

  it("should not let a check interrupt a download", () => {
    const downloading = run([
      { type: "checkStarted" },
      { type: "checkFinished", update: FOUND },
      { type: "downloadStarted" },
    ]);
    expect(reduce(downloading, { type: "checkStarted" })).toBe(downloading);
  });

  it("should not let a check undo an update that waits for its restart", () => {
    const ready: UpdateState = { status: "ready", version: "0.2.0" };
    expect(reduce(ready, { type: "checkStarted" })).toBe(ready);
  });

  it("should keep the message of a failure", () => {
    expect(run([{ type: "failed", message: "Pas de réseau." }])).toEqual({
      status: "failed",
      message: "Pas de réseau.",
    });
  });

  it("should let the learner check again after a failure", () => {
    expect(run([{ type: "failed", message: "x" }, { type: "checkStarted" }]).status).toBe(
      "checking",
    );
  });
});

describe("percent", () => {
  const downloading = (downloaded: number, total: number | null) =>
    ({ status: "downloading", version: "0.2.0", notes: null, downloaded, total }) as const;

  it("should be null while the size is unknown", () => {
    expect(percent(downloading(100, null))).toBeNull();
  });

  it("should give the share downloaded", () => {
    expect(percent(downloading(250, 1000))).toBe(25);
  });

  it("should never go over one hundred", () => {
    expect(percent(downloading(2000, 1000))).toBe(100);
  });
});
