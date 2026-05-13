import { assertEquals } from "@std/assert";
import {
  visibleLength,
  padLeft,
  padRight,
  padCenter,
  header,
  footer,
  divider,
  wrap,
  bar,
} from "../src/layout.ts";
import { defaultTheme } from "../src/theme.ts";

const OPTS = { sanitizeResources: false, sanitizeOps: false };

Deno.test("visibleLength strips MUSH and ANSI codes", OPTS, () => {
  assertEquals(visibleLength("hello"), 5);
  assertEquals(visibleLength("%chhello%cn"), 5);
  assertEquals(visibleLength("\x1b[31mred\x1b[0m"), 3);
  assertEquals(visibleLength("%chbold%cn %cgword%cn"), 9);
});

Deno.test("padLeft / padRight pad to visible width", OPTS, () => {
  assertEquals(padLeft("hi", 5), "hi   ");
  assertEquals(padRight("hi", 5), "   hi");
  assertEquals(visibleLength(padLeft("%chhi%cn", 10)), 10);
});

Deno.test("padCenter centers within width", OPTS, () => {
  assertEquals(padCenter("hi", 6), "  hi  ");
  assertEquals(visibleLength(padCenter("%chhi%cn", 10)), 10);
});

Deno.test("header / footer / divider produce theme.width visible chars", OPTS, async () => {
  const W = defaultTheme.width;
  assertEquals(visibleLength(await header("Title", defaultTheme)), W);
  assertEquals(visibleLength(await footer(defaultTheme)), W);
  assertEquals(visibleLength(await divider("Players", defaultTheme)), W);
  assertEquals(visibleLength(await divider(null, defaultTheme)), W);
});

Deno.test("renderHeader / renderFooter / renderDivider via theme renderer", OPTS, async () => {
  const { renderHeader, renderFooter, renderDivider } = await import("../src/renderer.ts");
  const { currentTheme } = await import("../src/theme.ts");
  const W = currentTheme().width;
  assertEquals(visibleLength(await renderHeader("Title")), W);
  assertEquals(visibleLength(await renderFooter()), W);
  assertEquals(visibleLength(await renderDivider("Section")), W);
  assertEquals(visibleLength(await renderDivider(null)), W);
});

Deno.test("wrap respects width and indent", OPTS, () => {
  const lines = wrap("the quick brown fox jumps over the lazy dog", 15, "  ");
  for (const ln of lines) {
    if (visibleLength(ln) > 15) {
      throw new Error(`line too long (${visibleLength(ln)}): ${ln}`);
    }
    assertEquals(ln.startsWith("  "), true);
  }
});

Deno.test("bar produces barWidth+2 visible chars and clamps", OPTS, () => {
  assertEquals(visibleLength(bar(5, 10, 20, defaultTheme)), 22);
  assertEquals(visibleLength(bar(99, 10, 8, defaultTheme)), 10);
  assertEquals(visibleLength(bar(-1, 10, 8, defaultTheme)), 10);
});
