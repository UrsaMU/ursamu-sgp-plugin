import type { IUrsamuSDK } from "../../@types/UrsamuSDK.ts";

/**
 * Rhost Vision: examine.ts
 * Full object examination — flags, owner, location, home, channels, attributes.
 * Only the object's owner, admins, and wizards may examine it unless it has
 * the VISUAL flag, in which case anyone can view its non-hidden attributes.
 *
 * Usage:  examine [<object>]   (defaults to "me")
 *
 * To activate:  copy this file to system/scripts/examine.ts
 * To deactivate: restore system/scripts/examine.ts from examine.original.ts
 */

const WIDTH = 78;

// Attributes that are part of the core object — not shown in the Attributes section.
const SYS_ATTRS = new Set([
  "name", "moniker", "alias", "owner", "lock",
  "description", "flags", "id", "location", "home",
  "password", "channels",
]);

const HIDDEN_ATTRS = new Set(["password"]);

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

function sectionLine(text: string | null): string {
  const body = text ? centerLine(text, "-") : "-".repeat(WIDTH);
  return `%ch%cw${body}%cn`;
}

function footerLine(): string {
  return `%ch%cw${"=".repeat(WIDTH)}%cn`;
}

function padLabel(label: string, width: number): string {
  return label + " ".repeat(Math.max(0, width - label.length));
}

export default async (u: IUrsamuSDK) => {
  const actor = u.me;
  const arg = (u.cmd.args[0] || "").trim() || "me";

  const candidates = await u.db.search(arg);
  const target = candidates[0];
  if (!target) {
    u.send(`I can't find "${arg}" here.`);
    return;
  }

  const canEdit = await u.canEdit(actor, target);
  if (!canEdit && !target.flags.has("visual")) {
    u.send("You can't examine that.");
    return;
  }

  const LW = 12;
  const field = (label: string, value: string) =>
    `  %ch%cw${padLabel(label, LW)}%cn ${value}`;

  // Resolve home and location names
  const homeId  = target.state.home;
  const homeObj = homeId ? (await u.db.search(String(homeId)))[0] : null;
  const homeLine = homeObj
    ? `${homeObj.name} (#${homeObj.id})`
    : String(homeId || "None");

  const locId  = target.location;
  const locObj = locId ? (await u.db.search(locId))[0] : null;
  const locLine = locObj
    ? `${locObj.name} (#${locId})`
    : (locId || "Limbo");

  const rawChans = target.state.channels as { channel: string; alias: string; active: boolean }[] | undefined;
  const chansLine = Array.isArray(rawChans) && rawChans.length
    ? rawChans
        .map((ch) => `${ch.channel}(${ch.alias})${ch.active ? "" : " [off]"}`)
        .join(", ")
    : "None";

  // Only show attributes not in the system set (and never hidden ones)
  const attrs = Object.entries(target.state).filter(
    ([k]) => !SYS_ATTRS.has(k.toLowerCase()) && !HIDDEN_ATTRS.has(k.toLowerCase()),
  );

  const lines: string[] = [];
  lines.push(headerLine(`${target.name} (#${target.id})`));
  lines.push(field("Flags:",    Array.from(target.flags).join(" ") || "(none)"));
  lines.push(field("Owner:",    String(target.state.owner || "None")));
  lines.push(field("Lock:",     String(target.state.lock  || "None")));
  lines.push(field("Location:", `%cy${locLine}%cn`));
  lines.push(field("Home:",     `%cy${homeLine}%cn`));
  lines.push(field("Channels:", chansLine));
  lines.push(sectionLine("Description"));
  const desc = String(target.state.description || "No description.");
  lines.push(`  ${desc}`);

  if (attrs.length > 0) {
    lines.push(sectionLine("Attributes"));
    for (const [k, v] of attrs) {
      let disp: string;
      if (v === null || v === undefined) {
        disp = "(not set)";
      } else if (Array.isArray(v)) {
        disp = v.map((i) => (typeof i === "object" ? JSON.stringify(i) : String(i))).join(", ");
      } else if (typeof v === "object") {
        disp = Object.entries(v as Record<string, unknown>)
          .map(([sk, sv]) => `${sk}: ${sv}`)
          .join(", ");
      } else {
        disp = String(v);
      }
      lines.push(`  %ch%cw${k.toUpperCase()}%cn  ${disp}`);
    }
  }

  const chars = (target.contents || []).filter((o) => o.flags.has("player"));
  if (chars.length > 0) {
    lines.push(sectionLine("Characters"));
    lines.push(
      "  " + chars.map((ch) => `%ch%cw${String(ch.state.name || ch.name || "?")}%cn`).join("  "),
    );
  }

  lines.push(footerLine());
  u.send(lines.join("\n"));

  const comp = [];
  comp.push(u.ui.panel({ type: "header", content: `${target.name} [#${target.id}]` }));
  comp.push(
    u.ui.panel({
      type: "list",
      title: "Metadata",
      content: [
        { label: "Flags",    value: Array.from(target.flags).join(" ") },
        { label: "Owner",    value: String(target.state.owner || "None") },
        { label: "Location", value: locLine },
        { label: "Home",     value: homeLine },
        { label: "Channels", value: chansLine },
      ],
    }),
  );
  comp.push(u.ui.panel({ type: "panel", title: "Description", content: desc }));
  if (attrs.length) {
    comp.push(
      u.ui.panel({
        type: "grid",
        title: "Attributes",
        content: attrs.map(([k, v]) => ({ label: k.toUpperCase(), value: String(v) })),
      }),
    );
  }
  u.ui.layout({ components: comp, meta: { type: "examine", targetId: target.id } });
};
