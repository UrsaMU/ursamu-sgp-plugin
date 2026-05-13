import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  blendStops,
  gradientName,
  hexToRgb,
  resolveColor,
  rgbToHex,
} from "../src/gradient.ts";

describe("color resolution", () => {
  it("resolves short ANSI codes", () => {
    assertEquals(resolveColor("hr"), { r: 0xff, g: 0x55, b: 0x55 });
    assertEquals(resolveColor("g"),  { r: 0x00, g: 0xaa, b: 0x00 });
  });

  it("resolves CSS names (case-insensitive)", () => {
    assertEquals(resolveColor("Gold"), { r: 0xff, g: 0xd7, b: 0x00 });
    assertEquals(resolveColor("CRIMSON"), { r: 0xdc, g: 0x14, b: 0x3c });
  });

  it("resolves xterm names when CSS doesn't cover them", () => {
    assertEquals(resolveColor("DodgerBlue1"), { r: 0x00, g: 0x87, b: 0xd7 });
    assertEquals(resolveColor("grey50"),      { r: 0x80, g: 0x80, b: 0x80 });
  });

  it("CSS wins over xterm on a name collision", () => {
    // "red" is in both registries; CSS red is pure #ff0000
    assertEquals(resolveColor("red"), { r: 0xff, g: 0x00, b: 0x00 });
  });

  it("resolves hex literals with or without leading #", () => {
    assertEquals(resolveColor("#ff8800"), { r: 0xff, g: 0x88, b: 0x00 });
    assertEquals(resolveColor("ff8800"),  { r: 0xff, g: 0x88, b: 0x00 });
  });

  it("returns null for unknown names", () => {
    assertEquals(resolveColor("glorbnax"),    null);
    assertEquals(resolveColor("#nothex"),     null);
    assertEquals(resolveColor(""),            null);
  });
});

describe("hex ↔ rgb", () => {
  it("round-trips a hex literal", () => {
    assertEquals(rgbToHex(hexToRgb("#abcdef")), "#abcdef");
  });

  it("clamps over/under-bounds when re-encoding", () => {
    assertEquals(rgbToHex({ r: 300, g: -10, b: 128 }), "#ff0080");
  });
});

describe("blendStops", () => {
  it("returns N samples", () => {
    const out = blendStops([{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }], 5);
    assertEquals(out.length, 5);
  });

  it("anchors at the endpoints", () => {
    const a = { r: 255, g:   0, b: 0   };
    const b = { r:   0, g: 255, b: 255 };
    const out = blendStops([a, b], 10);
    assertEquals(out[0], a);
    assertEquals(out[out.length - 1], b);
  });

  it("repeats a single stop across all steps", () => {
    const a = { r: 100, g: 100, b: 100 };
    const out = blendStops([a], 4);
    assertEquals(out, [a, a, a, a]);
  });

  it("handles three stops with intermediate anchor", () => {
    const r = { r: 255, g:   0, b:   0 };
    const g = { r:   0, g: 255, b:   0 };
    const b = { r:   0, g:   0, b: 255 };
    const out = blendStops([r, g, b], 5);
    assertEquals(out[0], r);
    assertEquals(out[4], b);
    // Middle sample should sit at the green anchor
    assertEquals(out[2], g);
  });
});

describe("gradientName", () => {
  it("colors every visible letter and leaves whitespace alone", () => {
    const out = gradientName("Hi there", ["red", "blue"]);
    assert(out !== null);
    const colored = out!;
    // 7 visible letters → 7 hex codes
    const codes = colored.match(/<#[0-9a-f]{6}>/g) ?? [];
    assertEquals(codes.length, 7);
    // Whitespace passes through
    assertStringIncludes(colored, " ");
    // Ends with a single reset
    assert(colored.endsWith("%cn"));
  });

  it("returns null when any stop is unknown", () => {
    assertEquals(gradientName("Alice", ["red", "glorbnax"]), null);
  });
});
