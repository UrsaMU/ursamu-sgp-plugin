/**
 * src/index.ts — IPlugin bootstrap for globals.
 *
 * Phase 1 (module load): imports commands.ts — all addCmd() calls run
 *                        immediately, before any plugin's init() fires.
 * Phase 2 (init):        backs up existing system scripts, then copies
 *                        the plugin's styled replacements into
 *                        system/scripts/.
 * Phase 3 (remove):      restores every backed-up script. The native
 *                        commands registered in Phase 1 are
 *                        garbage-collected when the module is unloaded.
 *
 * Script overrides installed:
 *   look, who, where, mail, page, score, examine, inventory
 *
 * Configuration:
 *   Edit src/theme.ts before installation to change colors, widths, and
 *   layout options. src/layout.ts provides shared utilities for native
 *   commands (+finger, +staff, …).
 */

import "./commands.ts";

import type { IPlugin } from "@ursamu/ursamu";
import * as dpath from "@std/path";
import { currentTheme, DEFAULT_THEME, loadTheme } from "./theme.ts";

// File-substitution table for theme-driven values baked into system scripts.
// Each entry is a [filename, transformer] pair; transformer receives the file's
// source text and returns the substituted text.
const SCRIPT_TRANSFORMS: Record<string, (src: string) => string> = {
  "look.ts": (src) => {
    const look = currentTheme().look;
    const tags = JSON.stringify(look.roleTags);
    return src
      .replace(
        /\/\*\s*\{\{ROLE_TAGS\}\}\s*\*\/\s*\[[\s\S]*?\];/m,
        `/* {{ROLE_TAGS}} */ ${tags};`,
      )
      .replace(
        /\/\*\s*\{\{SHOW_IDLE\}\}\s*\*\/\s*(?:true|false);/m,
        `/* {{SHOW_IDLE}} */      ${look.showIdle};`,
      )
      .replace(
        /\/\*\s*\{\{SHOW_SHORTDESC\}\}\s*\*\/\s*(?:true|false);/m,
        `/* {{SHOW_SHORTDESC}} */ ${look.showShortDesc};`,
      );
  },
};

const OVERRIDES = [
  "look.ts",
  "who.ts",
  "where.ts",
  "mail.ts",
  "page.ts",
  "score.ts",
  "examine.ts",
  "inventory.ts",
] as const;

function pluginScriptsDir(): string {
  return dpath.fromFileUrl(new URL("../scripts", import.meta.url));
}

function engineScriptsDir(): string {
  return dpath.join(Deno.cwd(), "system", "scripts");
}

export const plugin: IPlugin = {
  name:        "globals",
  version:     "1.2.0",
  description:
    "Modern globals package: themed display overrides plus native commands " +
    "for profiles, OOC, gradient names, MOTD, staff utilities, and more.",

  // Seeded into the engine's config/config.json under plugins["globals"]
  // on first run. Edit the file (or use the PluginConfigManager API) to retune
  // theme values from the game side. loadTheme() reads back through this path
  // and falls back to the plugin-local config/SgpConfig.json for dev runs
  // outside an ursamu engine.
  config: { theme: DEFAULT_THEME } as unknown as IPlugin["config"],

  init: async () => {
    await loadTheme();

    const srcDir  = pluginScriptsDir();
    const destDir = engineScriptsDir();

    await Deno.mkdir(destDir, { recursive: true });

    for (const file of OVERRIDES) {
      const src    = dpath.join(srcDir,  file);
      const dest   = dpath.join(destDir, file);
      const backup = dpath.join(destDir, file.replace(".ts", ".original.ts"));

      try {
        // Only back up once — don't clobber an existing .original.ts.
        try {
          await Deno.stat(backup);
        } catch {
          try {
            await Deno.copyFile(dest, backup);
            console.log(`[globals] Backed up original ${file}.`);
          } catch {
            // No pre-existing script to back up — that's fine.
          }
        }
        const transform = SCRIPT_TRANSFORMS[file];
        if (transform) {
          const raw = await Deno.readTextFile(src);
          await Deno.writeTextFile(dest, transform(raw));
        } else {
          await Deno.copyFile(src, dest);
        }
        console.log(`[globals] Installed ${file} override.`);
      } catch (e: unknown) {
        console.error(`[globals] Failed to install ${file}:`, e);
      }
    }

    console.log("[globals] v1.2.0 ready.");
    return true;
  },

  remove: async () => {
    const destDir = engineScriptsDir();

    for (const file of OVERRIDES) {
      const dest   = dpath.join(destDir, file);
      const backup = dpath.join(destDir, file.replace(".ts", ".original.ts"));
      try {
        await Deno.stat(backup);
        await Deno.copyFile(backup, dest);
        await Deno.remove(backup);
        console.log(`[globals] Restored original ${file}.`);
      } catch {
        try { await Deno.remove(dest); } catch { /* already gone */ }
      }
    }

    console.log("[globals] Removed.");
  },
};

export default plugin;
