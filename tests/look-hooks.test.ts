import { assert, assertEquals, assertStringIncludes } from "@std/assert";

// deno-lint-ignore no-explicit-any
const lookScript = (await import("../scripts/look.ts")).default as (u: any) => Promise<void>;

interface ResolveCall {
  slot: string;
  defaultArg: string;
}

// deno-lint-ignore no-explicit-any
function mkObj(overrides: Record<string, any> = {}): any {
  return {
    id: "10",
    name: "Thing",
    flags: new Set<string>(),
    state: {},
    contents: [],
    location: "limbo",
    ...overrides,
  };
}

function mkRoom() {
  return mkObj({
    id: "5",
    name: "OOC Polis",
    flags: new Set(["room"]),
    state: { name: "OOC Polis", description: "A wide plaza." },
    contents: [],
  });
}

function mkActor() {
  return mkObj({ id: "1", name: "Lem", flags: new Set(["player", "connected"]) });
}

// deno-lint-ignore no-explicit-any
function mkSDK(target: any, actor: any, resolver: (call: ResolveCall) => string | null) {
  const calls: ResolveCall[] = [];
  const sent: string[] = [];
  return {
    calls,
    sent,
    u: {
      me: actor,
      target: undefined,
      here: target,
      // deno-lint-ignore require-await
      canEdit: async () => false,
      send: (s: string) => sent.push(s),
      util: {
        // deno-lint-ignore no-explicit-any
        displayName: (o: any) => o.name ?? "Unknown",
        // deno-lint-ignore require-await
        resolveFormat: async (_t: unknown, slot: string, defaultArg: string) => {
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

Deno.test("look hooks — no overrides set → default render preserved", OPTS, async () => {
  const room = mkRoom();
  const actor = mkActor();
  const ctx = mkSDK(room, actor, () => null);

  await lookScript(ctx.u);

  const slots = ctx.calls.map((c) => c.slot).sort();
  assertEquals(slots, ["DESCFORMAT", "NAMEFORMAT"]);
  const out = ctx.sent.join("\n");
  assertStringIncludes(out, "OOC Polis");
  assertStringIncludes(out, "A wide plaza.");
});

Deno.test("NAMEFORMAT override replaces the header line", OPTS, async () => {
  const room = mkRoom();
  const ctx = mkSDK(room, mkActor(), (c) =>
    c.slot === "NAMEFORMAT" ? "%ch[OVERRIDE-HEADER]%cn" : null,
  );

  await lookScript(ctx.u);

  const out = ctx.sent.join("\n");
  assertStringIncludes(out, "[OVERRIDE-HEADER]");
  // Default header line contains "OOC Polis" between ='s. The override
  // replaces the *line*; the footer is a separate, content-less rule.
  assert(!/=+ OOC Polis =+/.test(out), "default header line should be suppressed");
});

Deno.test("DESCFORMAT override replaces description; %0 is the description text", OPTS, async () => {
  const room = mkRoom();
  let captured = "";
  const ctx = mkSDK(room, mkActor(), (c) => {
    if (c.slot === "DESCFORMAT") {
      captured = c.defaultArg;
      return "<<DESC>>";
    }
    return null;
  });

  await lookScript(ctx.u);

  assertEquals(captured, "A wide plaza.");
  assertStringIncludes(ctx.sent.join("\n"), "<<DESC>>");
});

Deno.test("CONFORMAT replaces Players + Contents; %0 is space-joined #ids", OPTS, async () => {
  const player = mkObj({
    id: "7",
    name: "Bob",
    flags: new Set(["player", "connected"]),
    state: { name: "Bob" },
  });
  const item = mkObj({ id: "8", name: "Lantern", flags: new Set(), state: { name: "Lantern" } });
  const room = mkRoom();
  room.contents = [player, item];

  let captured = "";
  const ctx = mkSDK(room, mkActor(), (c) => {
    if (c.slot === "CONFORMAT") {
      captured = c.defaultArg;
      return "CON-OVERRIDE";
    }
    return null;
  });

  await lookScript(ctx.u);

  assertEquals(captured, "#7 #8");
  const out = ctx.sent.join("\n");
  assertStringIncludes(out, "CON-OVERRIDE");
  assert(!out.includes("Players"), "default Players section should be suppressed");
  assert(!out.includes("Contents"), "default Contents section should be suppressed");
});

Deno.test("EXITFORMAT replaces exits section; %0 is space-joined exit #ids", OPTS, async () => {
  const exit = mkObj({
    id: "9",
    name: "north",
    flags: new Set(["exit"]),
    state: { name: "north;n" },
  });
  const room = mkRoom();
  room.contents = [exit];

  let captured = "";
  const ctx = mkSDK(room, mkActor(), (c) => {
    if (c.slot === "EXITFORMAT") {
      captured = c.defaultArg;
      return "EXIT-OVERRIDE";
    }
    return null;
  });

  await lookScript(ctx.u);

  assertEquals(captured, "#9");
  const out = ctx.sent.join("\n");
  assertStringIncludes(out, "EXIT-OVERRIDE");
  assert(!out.includes("Directions"), "default Directions section should be suppressed");
});
