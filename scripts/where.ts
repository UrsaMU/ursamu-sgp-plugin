import { IUrsamuSDK, IDBObj } from "../../@types/UrsamuSDK.ts";

/**
 * Rhost Vision: where.ts
 * +where - show online players grouped by area/zone.
 *
 * Output (78-char wide):
 * ============================= Player Locations ==============================
 *  Player                  Type  Idle  Location
 *  ---------------------------------------------------------------------------
 *  ---< Palatina >---------------------------------------------------------
 *   Victor                       0s    Forum Romanum
 *   Molly                 Staff  4h    Old Shoppe Circle
 *  ---< OOC >--------------------------------------------------------------
 *   Jupiter                      1m    OOC Polis
 *  ---------------------------------------------------------------------------
 *                          There are 3 players online.
 * =============================================================================
 */

export const aliases = ["+where", "where"];

const WIDTH = 78;

function visualLen(s: string): number {
  return s.replace(/%c[rRgGyYbBmMcCwWxXnh]|%cn|%ch|%ct/g, "").length;
}

function centerLine(text: string, char: string, width: number): string {
  const t = ` ${text} `;
  const tLen = visualLen(t);
  const pad = Math.floor((width - tLen) / 2);
  const right = width - pad - tLen;
  return char.repeat(Math.max(0, pad)) + t + char.repeat(Math.max(0, right));
}

function formatIdle(lastCommand: unknown): { text: string; seconds: number } {
  if (typeof lastCommand !== "number") return { text: "??", seconds: 99999 };
  const diff = Math.floor((Date.now() - lastCommand) / 1000);
  let text: string;
  if (diff < 60) text = `${diff}s`;
  else if (diff < 3600) text = `${Math.floor(diff / 60)}m`;
  else if (diff < 86400) text = `${Math.floor(diff / 3600)}h`;
  else text = `${Math.floor(diff / 86400)}d`;
  return { text, seconds: diff };
}

function colorIdle(text: string, seconds: number): string {
  if (seconds < 60) return `%cg${text}%cn`;
  if (seconds < 600) return `%cg${text}%cn`;
  if (seconds < 3600) return `%cy${text}%cn`;
  if (seconds < 86400) return `%cy${text}%cn`;
  return `%ch%cx${text}%cn`;
}

function isStaff(player: IDBObj): boolean {
  return (
    player.flags.has("superuser") ||
    player.flags.has("admin") ||
    player.flags.has("wizard")
  );
}

export default async (u: IUrsamuSDK) => {
  const allPlayers = (await u.db.search({ flags: /connected/i })).filter(
    (p: IDBObj) => p.flags.has("player"),
  );

  const callerIsStaff = isStaff(u.me);

  interface PlayerInfo {
    name: string;
    colorName: string;
    staff: boolean;
    idle: string;
    idleSeconds: number;
    location: string;
    area: string;
    unfindable: boolean;
    dark: boolean;
  }

  const players: PlayerInfo[] = [];

  for (const p of allPlayers) {
    const name = (p.state?.moniker as string) || (p.state?.name as string) || p.name || "Unknown";
    const nc = (p.state?.name_color as string) || "";
    const colorName = nc && name.length > 0
      ? `${nc}${name[0]}%cn%ch%cw${name.slice(1)}%cn`
      : name;
    const staff = isStaff(p);
    const dark = p.flags.has("dark");
    const { text: idle, seconds: idleSeconds } = formatIdle(p.state?.lastCommand);

    // Get room info
    const roomName = u.here && p.id === u.me.id
      ? ((u.here.state?.name as string) || u.here.name || "Unknown")
      : "Unknown";

    // Look up the player's room
    let location = "Unknown";
    let area = "Unknown";
    let unfindable = false;

    const locId = p.location;
    if (locId) {
      const rooms = await u.db.search({ id: locId });
      if (rooms.length > 0) {
        const room = rooms[0];
        location = (room.state?.name as string) || room.name || "Unknown";
        location = location.replace(/\s*#\d+$/, "");
        area = (room.state?.grid_area as string) || "Unknown";
        unfindable = room.flags.has("dark") || room.flags.has("unfindable");
      }
    }

    players.push({ name, colorName, staff, idle, idleSeconds, location, area, unfindable, dark });
  }

  // Group by area
  const areas = new Map<string, PlayerInfo[]>();
  const unfindablePlayers: PlayerInfo[] = [];

  for (const p of players) {
    // Skip dark players from non-staff view
    if (p.dark && !callerIsStaff) continue;

    if (p.unfindable && !callerIsStaff) {
      unfindablePlayers.push(p);
    } else {
      const list = areas.get(p.area) || [];
      list.push(p);
      areas.set(p.area, list);
    }
  }

  // Sort players within each area alphabetically
  for (const [, list] of areas) {
    list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }

  // Sort areas alphabetically, OOC always last
  const sortedAreas = [...areas.keys()].sort((a, b) => {
    if (a.toUpperCase() === "OOC") return 1;
    if (b.toUpperCase() === "OOC") return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  // Build output
  const lines: string[] = [];

  // Header
  lines.push(" " + centerLine("Player Locations", "=", WIDTH));

  // Column headers — match Evennia layout:
  //  " Player<20>  Type<6> Idle<4>  Location"
  lines.push(` %cc${"Player".padEnd(20)}  ${"Type".padEnd(6)} ${"Idle".padStart(4)}  Location%cn`);
  lines.push(" " + "-".repeat(WIDTH));

  for (const area of sortedAreas) {
    // Area section header
    const prefix = "---< ";
    const suffix = " >";
    const areaLabel = `${prefix}%cc${area}%cn${suffix}`;
    const areaVisualLen = prefix.length + area.length + suffix.length;
    const dashes = "-".repeat(Math.max(0, WIDTH - areaVisualLen));
    lines.push(` ${areaLabel}${dashes}`);

    const list = areas.get(area) || [];
    for (const p of list) {
      const namePad = " ".repeat(Math.max(1, 20 - p.name.length));
      const typeCol = p.staff ? "%chStaff%cn " : "      ";
      const idleColored = colorIdle(p.idle, p.idleSeconds);
      const idlePadded = p.idle.padStart(4);
      const idleCol = idlePadded.replace(p.idle, idleColored);
      const locCol = p.location;

      lines.push(` ${p.colorName}${namePad}  ${typeCol} ${idleCol}  ${locCol}`);
    }
  }

  // Unfindable section
  if (unfindablePlayers.length > 0) {
    lines.push(" " + "-".repeat(WIDTH));
    lines.push(" Unfindable:");
    unfindablePlayers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    for (const p of unfindablePlayers) {
      const idleColored = colorIdle(p.idle, p.idleSeconds);
      lines.push(`  ${p.colorName} ${idleColored}`);
    }
  }

  // Footer
  lines.push(" " + "-".repeat(WIDTH));
  const count = players.filter(p => !p.dark || callerIsStaff).length;
  const footer = count === 1
    ? "There is 1 player online."
    : `There are ${count} players online.`;
  lines.push(footer.padStart(Math.floor((WIDTH + footer.length) / 2)));
  lines.push(" " + "=".repeat(WIDTH));

  u.send(lines.join("\n"));
};
