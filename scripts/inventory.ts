import type { IUrsamuSDK } from "../../@types/UrsamuSDK.ts";

/**
 * Rhost Vision: inventory.ts
 * Lists everything the player is carrying in Rhost-style bordered output.
 *
 * Usage:  inventory  (or the engine's built-in alias "i")
 *
 * Each item shows its short description (&short-desc) if set, truncated
 * so the line never exceeds the display width.
 *
 * To activate:  copy this file to system/scripts/inventory.ts
 * To deactivate: restore system/scripts/inventory.ts from inventory.original.ts
 */

const WIDTH = 78;

function visualLen(s: string): number {
  // deno-lint-ignore no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/%c[a-zA-Z]/g, "").replace(/%[rRnt]/g, "").length;
}

function centerLine(text: string, char: string): string {
  const t = ` ${text} `;
  const tLen = visualLen(t);
  const pad = Math.floor((WIDTH - tLen) / 2);
  return char.repeat(Math.max(0, pad)) + t + char.repeat(Math.max(0, WIDTH - pad - tLen));
}

function headerLine(text: string): string {
  return `%ch%cw${centerLine(text, "=")}%cn`;
}

function sectionLine(): string {
  return `%ch%cw${"-".repeat(WIDTH)}%cn`;
}

function footerLine(): string {
  return `%ch%cw${"=".repeat(WIDTH)}%cn`;
}

export default (u: IUrsamuSDK) => {
  const actor = u.me;
  const name  = String(actor.state.moniker || actor.state.name || actor.name || "Unknown");

  // Contents that aren't exits, rooms, or other players.
  const items = (actor.contents || []).filter(
    (o) => !o.flags.has("exit") && !o.flags.has("room") && !o.flags.has("player"),
  );

  const lines: string[] = [];
  lines.push(headerLine(`${name}'s Inventory`));

  if (items.length === 0) {
    lines.push("  You are not carrying anything.");
  } else {
    for (const item of items) {
      const iname    = `%ch%cw${String(item.state.name || item.name || "Unknown")}%cn`;
      const sd       = String(item.state["short-desc"] || item.state.shortdesc || "");
      const prefix   = `  ${iname}`;
      const prefixW  = visualLen(prefix);
      const maxSdLen = WIDTH - prefixW - 4;
      const sdPart   = sd ? `  ${sd.slice(0, Math.max(0, maxSdLen))}` : "";
      lines.push(`${prefix}${sdPart}`);
    }
  }

  lines.push(sectionLine());
  lines.push(`  ${items.length} item${items.length === 1 ? "" : "s"}.`);
  lines.push(footerLine());
  u.send(lines.join("\n"));

  const comp = [];
  comp.push(u.ui.panel({ type: "header", content: "Inventory" }));
  if (!items.length) {
    comp.push(u.ui.panel({ content: "Empty." }));
  } else {
    comp.push(
      u.ui.panel({
        type: "list",
        content: items.map((i) => ({
          name: String(i.state.name || i.name || "Unknown"),
          desc: String(i.state["short-desc"] || i.state.shortdesc || ""),
        })),
      }),
    );
  }
  u.ui.layout({ components: comp, meta: { type: "inventory", count: items.length } });
};
