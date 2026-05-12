# rhost-vision — UrsaMU Plugin

Rhost-style command formatting. Two distinct surfaces:

1. **System-script overrides** (`scripts/`) — file-copied into the engine's
   `system/scripts/` from `init()`. Replace the engine's stock `look`, `who`,
   `where`, `mail`, `page`, `score`, `examine`, `inventory`.
2. **Native commands** (`src/`) — registered with `addCmd()` at module load:
   `+finger`, `+staff`, `ooc`, `+ooccolor`, `+ooccolor2`, `+namecolor`,
   `@emit`.

## Setup (do this first)

```bash
npx @lhi/ursamu-dev         # install the dev skill
ursamu-dev --install-hooks  # block commits that fail the audit
```

Activate in Claude Code: `/ursamu-dev`

The skill enforces a six-stage pipeline (Design → Generate → Audit → Refine
→ Test → Docs) and knows every import path, SDK method, lock level, and
security pattern. Use it for every feature — no exceptions.

---

## Commands

```bash
deno task test                   # full suite — must stay green
deno task lint                   # must be clean
deno task check                  # type-check entry points
```

## Pre-commit checklist

```bash
deno task lint
deno task test --no-check
```

---

## Structure

```
index.ts                Engine entry — re-exports src/index.ts
mod.ts                  JSR module surface (theme, layout, coloredName)
src/
├── index.ts            IPlugin — init() copies scripts, remove() restores
├── commands.ts         addCmd() registrations (module-load, NOT in init)
├── finger.ts           +finger / +finger/set
├── ooc.ts              ooc, +ooccolor, +ooccolor2
├── namecolor.ts        +namecolor (staff first-letter colour) + coloredName()
├── staff.ts            +staff (online staff list)
├── emit.ts             @emit (staff room broadcast)
├── theme.ts            RhostTheme + defaultTheme + customTheme override
└── layout.ts           Pure 78-col layout helpers (header/footer/divider/…)
scripts/                System-script overrides — copied into system/scripts/
help/                   In-game help files (info/, social/)
tests/                  Deno test files
```

### The two file zones — important

* **`src/*.ts`** — runs *inside* the plugin's own module. Imports from
  `@ursamu/ursamu` JSR. Standard plugin code.
* **`scripts/*.ts`** — these files are **copied** at runtime into the
  engine's `system/scripts/` directory and executed by `SandboxService`
  (`src/services/Sandbox/SandboxService.ts` in the engine) inside a Deno
  Worker. The sandbox transpiles the file with sucrase, then **regex-strips
  every top-level `import` statement** before evaluation:

  ```js
  compiled = compiled.replace(/^import\s+.*?;?\s*$/gm, "");
  ```

  Consequences:

  - **Type-only imports are fine** — `import type { … }` is elided at TS→JS
    compile, so it never reaches the stripper. That's why
    `import type { IUrsamuSDK, IDBObj } from "../../@types/UrsamuSDK.ts"`
    works.
  - **Runtime imports do not work** — not JSR (`@ursamu/ursamu`), not
    relative paths into the engine source, not `src/` helpers. The
    `import` line is deleted and the bound name is `undefined` at
    runtime.
  - **All runtime capabilities come through the injected `u` (SDK)**.
    `u.db`, `u.util`, `u.send`, `u.cmd`, etc. If a helper you need isn't
    on the SDK, add it to the engine SDK first, then consume it as
    `u.<namespace>.<helper>` from the script.
  - **No shared modules between scripts** — if two scripts need the same
    layout helper, either inline it in both, or use `inlineUtils()` from
    `src/layout.ts` to bake it in at write time.

---

## Import paths

```typescript
// Native commands (src/)
import { addCmd, dbojs, send, gameHooks, DBO } from "@ursamu/ursamu";
import type { IPlugin, IUrsamuSDK, IDBObj, IDBOBJ } from "@ursamu/ursamu";
```

System scripts (`scripts/`) keep relative imports — see note above.

---

## addCmd skeleton

```typescript
addCmd({
  name: "+finger",
  pattern: /^\+finger(?:\/(\S+))?\s*(.*)/i,  // args[0]=switch, args[1]=rest
  lock: "connected",
  category: "Profile",
  help: `+finger[/set] [<player>]  — Display a character's profile.

Switches:
  /set <field>=<value>   Set or clear a finger field.

Examples:
  +finger Alice           Show Alice's profile.
  +finger/set alias=Al    Set your own alias.`,
  exec: async (u: IUrsamuSDK) => {
    const sw  = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const arg = u.util.stripSubs(u.cmd.args[1] ?? "").trim();
  },
});
```

### Pattern cheat-sheet

| Intent | Pattern | args |
|--------|---------|------|
| No args | `/^inventory$/i` | — |
| One arg | `/^look\s+(.*)/i` | `[0]` |
| Switch + arg | `/^\+cmd(?:\/(\S+))?\s*(.*)/i` | `[0]`=sw, `[1]`=rest |
| Two parts (=) | `/^@name\s+(.+)=(.+)/i` | `[0]`, `[1]` |

### Lock levels

| String | Who can use it |
|--------|----------------|
| `""` | Login screen (unauthenticated) |
| `"connected"` | Any logged-in player |
| `"connected builder+"` | Builder flag or higher |
| `"connected admin+"` | Admin flag or higher |
| `"connected wizard"` | Wizard only |

---

## Plugin lifecycle (src/index.ts)

```typescript
import "./commands.ts";  // Phase 1 — addCmd() fires here, NOT in init()

export const plugin: IPlugin = {
  name: "rhost-vision",
  version: "1.2.0",
  description: "One sentence.",
  init:   async () => { /* copy scripts/ into system/scripts/ */ return true; },
  remove: async () => { /* restore .original.ts backups */ },
};
```

Rules:
- `addCmd()` never inside `init()`.
- `init()` must return `true` (or a Promise resolving to `true`).
- Every `gameHooks.on()` needs a matching `.off()` using the same named
  function reference — anonymous arrows cannot be removed.
- DBO collections always prefixed: `new DBO("rhost-vision.<name>")`.

---

## Theming

`src/theme.ts` exports `defaultTheme` and an optional `customTheme` override.
The `RhostTheme` interface controls width, border characters, colour palette,
and per-feature toggles for `look` and `who`. Theme values are baked into the
generated system scripts via `inlineUtils()` at install time, so changes
require a plugin reload.

```typescript
// src/theme.ts
export const customTheme: Partial<RhostTheme> | undefined = {
  width: 80,
  colors: { ...defaultTheme.colors, border: "%ch%cb", header: "%ch%cb" },
};
```

---

## Code style (non-negotiable)

- Early return over nested conditions.
- No function longer than 50 lines — decompose.
- No file longer than 200 lines — split. (Existing `mail.ts` and `look.ts`
  exceed this; do not grow them further without splitting.)
- No bare `catch` — always `catch (e: unknown)`.
- No deep nesting — max 3 levels.
- No comments unless the WHY is non-obvious.
- All `%c*` colour codes must close with `%cn`.

---

## Audit checklist

- [ ] `u.util.stripSubs()` on all user strings before DB ops or length checks
- [ ] DB writes use `"$set"` / `"$inc"` / `"$unset"` — never raw overwrite
- [ ] All `%c*` colour codes closed with `%cn`
- [ ] `init()` returns `true`
- [ ] Every `addCmd` has `help:` with syntax line + examples
- [ ] Every help file ≤ 22 content lines and ≤ 78 characters per line
- [ ] System scripts in `scripts/` keep relative imports — never `@ursamu/...`
- [ ] System scripts are self-contained (no imports from `src/`)

---

## Help file format

Every `help/<group>/<name>.md` follows this layout (≤78-char width, ≤22 lines):

```
+COMMAND-NAME

One-sentence description of what **+command-name** does.

SYNTAX
  +command[/switch] <required> [<optional>]

SWITCHES
  /switch    What this switch does.

EXAMPLES
  +command foo       Does the thing.
  +command/switch x  Does the other thing.

SEE ALSO: +help related-topic
```

Files live under `help/info/` (system commands) or `help/social/` (native
social commands). Sub-files in a multi-page topic must open with a
back-reference to the parent and end with `SEE ALSO`.

---

## PRs and commits

- No AI attribution in commit messages or code comments.
- Conventional Commits: `feat`, `fix`, `refactor`, `docs`, `chore`.
- Squash-merge feature PRs.
- Tag versions after squash-merge: `git tag v<version> && git push --tags`.
