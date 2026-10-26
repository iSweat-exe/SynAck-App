import { describe, expect, it } from "vitest";
import { PROTOCOLS } from "./catalog";

// Every migration, as one text. The server computes experience and coins from its own copy of
// the catalog (`catalog_items`): a protocol it does not know earns nothing.
const MIGRATIONS = Object.values(
  import.meta.glob("../../supabase/migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
).join("\n");

describe("the server catalog", () => {
  it.each(PROTOCOLS.map((protocol) => [protocol.id, protocol.difficulty] as const))(
    "knows the protocol %s with its difficulty (%s)",
    (id, difficulty) => {
      expect(MIGRATIONS).toContain(`('protocol', '${id}', '${difficulty}')`);
    },
  );
});
