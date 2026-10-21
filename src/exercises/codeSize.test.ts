import { describe, expect, it } from "vitest";
import { MAX_CODE_BYTES, codeSize } from "./codeSize";

describe("codeSize", () => {
  it("should count bytes, not characters", () => {
    expect(codeSize("é").bytes).toBe(2);
  });

  it("should be ok for a short program", () => {
    expect(codeSize("print(1)").level).toBe("ok");
  });

  it("should warn at 90 % of the limit", () => {
    expect(codeSize("a".repeat(MAX_CODE_BYTES * 0.9)).level).toBe("near");
  });

  it("should accept exactly the limit", () => {
    expect(codeSize("a".repeat(MAX_CODE_BYTES)).level).toBe("near");
  });

  it("should refuse one byte above the limit", () => {
    expect(codeSize("a".repeat(MAX_CODE_BYTES + 1)).level).toBe("over");
  });
});
