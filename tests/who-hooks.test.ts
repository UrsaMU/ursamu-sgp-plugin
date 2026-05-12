import { assert, assertEquals, assertStringIncludes } from "@std/assert";

// deno-lint-ignore no-explicit-any
const whoScript = (await import("../scripts/who.ts")).default as (u: any) => Promise<void>;

interface ResolveCall {
  slot: string;
  defaultArg: string;
}

// deno-lint-ignore no-explicit-any
function mkPlayer(name: string, opts: Record<string, any> = {}): any {
  return {
    id: opts.id ?? "1",
    name,
    flags: new Set(["player", "connected"]),
    state: { name, lastLogin: Date.now() - 60_000, lastCommand: Date.now() - 1000, ...opts.state },
    contents: [],
  };
}

// deno-lint-ignore no-explicit-any
function mkSDK(players: any[], resolver: (call: ResolveCall) => string | null) {
  const calls: ResolveCall[] = [];
  const sent: string[] = [];
  return {
    calls,
    sent,
    u: {
      me: mkPlayer("Lem"),
      // deno-lint-ignore require-await
      db: { search: async () => players },
      send: (s: string) => sent.push(s),
      util: {
        // deno-lint-ignore require-await
        resolveGlobalFormat: async (slot: string, defaultArg: string) => {
          const call = { slot, defaultArg };
          calls.push(call);
          return resolver(call);
        },
      },
      ui: {
        // deno-lint-ignore no-explicit-any
        panel: (x: any) => x,
        layout: () => {},
      },
    },
  };
}

const OPTS = { sanitizeResources: false, sanitizeOps: false };

Deno.test("who hooks — no overrides → default block sent, both slots consulted", OPTS, async () => {
  const ctx = mkSDK([mkPlayer("Alice", { id: "2" })], () => null);

  await whoScript(ctx.u);

  const slots = ctx.calls.map((c) => c.slot).sort();
  // 1 row + 1 block = 2 calls
  assertEquals(slots, ["WHOFORMAT", "WHOROWFORMAT"]);
  const out = ctx.sent.join("\n");
  assertStringIncludes(out, "Alice");
  assertStringIncludes(out, "Player Name");
  assertStringIncludes(out, "1 Player logged in.");
});

Deno.test("WHOROWFORMAT replaces each row; %0 is the default row text", OPTS, async () => {
  const captured: string[] = [];
  const ctx = mkSDK(
    [mkPlayer("Alice", { id: "2" }), mkPlayer("Bob", { id: "3" })],
    (c) => {
      if (c.slot === "WHOROWFORMAT") {
        captured.push(c.defaultArg);
        return `ROW(${c.defaultArg.trim().split(/\s+/)[0]})`;
      }
      return null;
    },
  );

  await whoScript(ctx.u);

  assertEquals(captured.length, 2, "called once per player");
  assert(captured[0].includes("Alice") || captured[1].includes("Alice"));
  const out = ctx.sent.join("\n");
  assertStringIncludes(out, "ROW(Alice)");
  assertStringIncludes(out, "ROW(Bob)");
});

Deno.test("WHOFORMAT replaces the entire block; %0 is the default block", OPTS, async () => {
  let captured = "";
  const ctx = mkSDK([mkPlayer("Alice", { id: "2" })], (c) => {
    if (c.slot === "WHOFORMAT") {
      captured = c.defaultArg;
      return "ONLY-LINE";
    }
    return null;
  });

  await whoScript(ctx.u);

  assertStringIncludes(captured, "Player Name");
  assertStringIncludes(captured, "Alice");
  assertEquals(ctx.sent, ["ONLY-LINE"]);
});

Deno.test("row and block overrides compose: rows feed the default block before WHOFORMAT", OPTS, async () => {
  let blockArg = "";
  const ctx = mkSDK([mkPlayer("Alice", { id: "2" })], (c) => {
    if (c.slot === "WHOROWFORMAT") return "ROW-X";
    if (c.slot === "WHOFORMAT") {
      blockArg = c.defaultArg;
      return null;
    }
    return null;
  });

  await whoScript(ctx.u);

  assertStringIncludes(blockArg, "ROW-X");
  assert(!blockArg.includes("Alice"), "row override should mask the default row");
});
