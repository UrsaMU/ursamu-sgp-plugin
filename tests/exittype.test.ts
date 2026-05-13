import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

// Call the exec function directly — no addCmd plumbing required, so the test
// runs under default `deno task test` without any showcase import map.
import { execExitType } from "../src/exittype.ts";

interface MockExit {
  id: string;
  name: string;
  flags: Set<string>;
  state: Record<string, unknown>;
  data: { attributes: Array<{ name: string; value: string; type?: string; setter?: string }> };
}

function mockExit(overrides: Partial<MockExit> = {}): MockExit {
  return {
    id: "exit-1",
    name: "Inn",
    flags: new Set(["exit"]),
    state: {},
    data: { attributes: [] },
    ...overrides,
  };
}

interface MockOpts {
  args: string[];
  targetResult?: MockExit | null;
  canEdit?: boolean;
}

// deno-lint-ignore no-explicit-any
function mockU(opts: MockOpts): any {
  const sent: string[] = [];
  // deno-lint-ignore no-explicit-any
  const me: any = { id: "me", name: "Builder", flags: new Set(["connected", "builder"]) };
  // deno-lint-ignore no-explicit-any
  const target: any = opts.targetResult ?? null;
  // deno-lint-ignore no-explicit-any
  const attrCalls: any[] = [];
  return {
    me,
    cmd: { name: "@exittype", original: "", args: opts.args },
    send: (m: string) => sent.push(m),
    canEdit: () => Promise.resolve(opts.canEdit ?? true),
    util: {
      stripSubs: (s: string) =>
        // deno-lint-ignore no-control-regex
        s.replace(/\x1b\[[^m]*m/g, "").replace(/%c[a-z]/gi, ""),
      target: () => Promise.resolve(target),
      displayName: (o: MockExit) => o.name,
    },
    attr: {
      set: (id: string, name: string, value: string) => {
        attrCalls.push(["set", id, name, value]);
        if (target) {
          const existing = target.data.attributes.find(
            // deno-lint-ignore no-explicit-any
            (a: any) => a.name.toUpperCase() === name.toUpperCase(),
          );
          if (existing) existing.value = value;
          else target.data.attributes.push({ name, value });
        }
        return Promise.resolve();
      },
      clear: (id: string, name: string) => {
        attrCalls.push(["clear", id, name]);
        if (!target) return Promise.resolve(false);
        const idx = target.data.attributes.findIndex(
          // deno-lint-ignore no-explicit-any
          (a: any) => a.name.toUpperCase() === name.toUpperCase(),
        );
        if (idx === -1) return Promise.resolve(false);
        target.data.attributes.splice(idx, 1);
        return Promise.resolve(true);
      },
    },
    _sent: sent,
    _attrCalls: attrCalls,
  };
}

describe("@exittype command", () => {
  it("sets TYPE attribute — happy path", async () => {
    const exit = mockExit();
    const u = mockU({ args: ["Inn", "tavern"], targetResult: exit });
    await execExitType(u);
    assertEquals(u._attrCalls[0], ["set", "exit-1", "TYPE", "tavern"]);
    assertStringIncludes(u._sent[0], "Set TYPE on Inn to tavern");
  });

  it("clears TYPE attribute when value is empty", async () => {
    const exit = mockExit({ data: { attributes: [{ name: "TYPE", value: "tavern" }] } });
    const u = mockU({ args: ["Inn", ""], targetResult: exit });
    await execExitType(u);
    assertEquals(u._attrCalls[0], ["clear", "exit-1", "TYPE"]);
    assertStringIncludes(u._sent[0], "Cleared TYPE on Inn");
  });

  it("clear on already-unset exit — no-op message, no attr write", async () => {
    const exit = mockExit();
    const u = mockU({ args: ["Inn", ""], targetResult: exit });
    await execExitType(u);
    assertStringIncludes(u._sent[0], "had no TYPE set");
    // Only the clear *attempt* should have fired; no set call
    assertEquals(u._attrCalls.length, 1);
    assertEquals(u._attrCalls[0][0], "clear");
  });

  it("null target — graceful not-found, no attr write", async () => {
    const u = mockU({ args: ["NoSuchExit", "tavern"], targetResult: null });
    await execExitType(u);
    assertStringIncludes(u._sent[0], "No exit found matching");
    assertEquals(u._attrCalls.length, 0);
  });

  it("target is not an exit — refuses with no-op", async () => {
    const room = mockExit({ flags: new Set(["room"]) });
    const u = mockU({ args: ["Town Square", "tavern"], targetResult: room });
    await execExitType(u);
    assertStringIncludes(u._sent[0], "is not an exit");
    assertEquals(u._attrCalls.length, 0);
  });

  it("permission denied — no attr write", async () => {
    const exit = mockExit();
    const u = mockU({ args: ["Inn", "tavern"], targetResult: exit, canEdit: false });
    await execExitType(u);
    assertStringIncludes(u._sent[0], "Permission denied");
    assertEquals(u._attrCalls.length, 0);
  });

  it("input sanitization — stripSubs called before lookup", async () => {
    const exit = mockExit();
    const u = mockU({ args: ["%chInn%cn", "%cgtavern%cn"], targetResult: exit });
    await execExitType(u);
    // The captured attr value should be sanitized
    assertEquals(u._attrCalls[0][3], "tavern");
  });
});

// Sanity check on look.ts's getExitType / sectionTitle behavior would belong
// in a separate script-level test; the showcase runner exercises them
// end-to-end already.
