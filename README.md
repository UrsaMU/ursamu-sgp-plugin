# @ursamu/globals

A modern globals package for [UrsaMU](https://github.com/UrsaMU/ursamu) —
spiritual successor to the 2000-era [Sandbox Globals Project (SGP)](http://www.tinymux.org/files/sgp1_0.tgz),
ported to TypeScript and rebuilt around UrsaMU's native command and attribute
systems.

What SGP bundled as `&CMD-*` softcoded globals on a master-room object,
this plugin ships as first-class native commands: themed displays for the
engine's stock surfaces (look/who/where/page/mail/score/examine/inventory),
plus character profiles, OOC chat, gradient names, builder tools, MOTD,
staff utilities, and inventory views.

## What you get

### Themed display overrides

The plugin installs styled replacements for the engine's stock display
scripts on `init()` and restores the originals on `remove()`.

| Command     | Replacement                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `look`      | Centered header, role-tag column, color-coded idle, `@moniker` verbatim, 3-column exits grouped by TYPE |
| `who`       | Sortable WHO with `On For` / `Idle` / `Doing`; moniker + first-letter color rendering                    |
| `where`     | Online players grouped by area / zone; staff bypass unfindable                                           |
| `mail`      | Full MUSH-style mail: drafts, replies, forwards, CC/BCC, URFS flags                                      |
| `page`      | Alias-aware, moniker-aware, pose form (`page <target>=:<pose>`)                                          |
| `score`     | Scorecard with customisable `&SCORE-EXTRA` stat block                                                    |
| `examine`   | Flags, owner, lock, channels, attributes (respects `VISUAL`, redacts secrets)                            |
| `inventory` | Bordered output with inline short descriptions                                                           |

When you look AT something (not just the room), each surface gets its own
themed card: player profile (moniker, role, short-desc, full desc, Carrying,
idle), exit (name + first alias, description), or object (description +
Contents section).

### Native commands

| Command                                       | Description                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `+finger`, `+finger/set`                       | Character profile backed by `&attributes` (alias from `@alias`, plus PRONOUNS, POSITION, …) |
| `+staff`                                      | List online, non-dark, on-duty staff                                              |
| `+glance`                                     | Compact one-line-per-occupant room scan                                           |
| `+duty`                                       | Toggle staff on/off-duty (off-duty hides from `+staff`)                           |
| `+i`, `+inv <player>`                          | See what another player is carrying (same-room; staff bypass)                     |
| `+gname <color> <color> [<color> …]`           | Gradient `@moniker` — HSL blend across CSS + xterm + #hex stops                   |
| `ooc`, `+ooctag`                              | In-room OOC chat with a per-player tag literal override                           |
| `@emit`                                       | Staff-only verbatim room broadcast                                                |
| `@exittype <exit>=<type>`                     | Tag an exit's TYPE attribute (drives look's exit sections)                        |
| `+motd[/set,/del,/list,/reset]`                | Game-wide Message of the Day (general + staff scopes)                             |
| `+summon`, `+rsummon`, `+join`, `+rjoin`      | Staff teleport set; each pair remembers an origin                                 |
| `+uptime`                                     | Themed panel: boot time, current time, runtime                                    |

## Install

Add to your game's plugin manifest:

```json
{
  "plugins": ["@ursamu/globals"]
}
```

Or symlink during local development:

```bash
ln -s /path/to/ursamu-sgp-plugin /path/to/ursamu/src/plugins/globals
```

On first boot the plugin backs up your engine's
`system/scripts/{look,who,where,mail,page,score,examine,inventory}.ts` to
`*.original.ts` and copies its replacements in. Removing the plugin restores
the originals.

## Theme

The plugin's defaults live in [`src/theme.ts`](./src/theme.ts). Operators
override via the engine's `config/config.json` under
`plugins["globals"].theme` — the plugin reads engine config first, then
falls back to a local `config/SgpConfig.json` for dev runs outside an engine,
then to the hardcoded defaults.

Themed surfaces include:

- **`messages`** — prefix + per-level colors (info / success / warning / error / highlight)
- **`ooc`** — full literal tag, sayFormat, poseFormat (`{tag}`, `{name}`, `{message}` placeholders)
- **`look.roleTags`** — ordered list of `{ flag, display }`. First match wins; empty list disables the column. Baked into the look script at install time, so reload the plugin to apply.
- **`colors`**, **`tokens`**, **`headerfmt` / `dividerfmt` / `footerfmt`** — border characters and color palette used by `+finger`, `+staff`, etc. (driven through the mushcode renderer; no reload needed.)

```jsonc
// config/config.json (game-side)
{
  "plugins": {
    "globals": {
      "theme": {
        "ooc": {
          "tag":        "[%cyOOC%cn]",
          "sayFormat":  "{tag} {name}: {message}",
          "poseFormat": "{tag} * {name} {message}"
        },
        "look": {
          "roleTags": [
            { "flag": "wizard",    "display": "%ch%cy(Wiz)%cn" },
            { "flag": "admin",     "display": "(Admin)"        },
            { "flag": "staff",     "display": "(Staff)"        }
          ]
        }
      }
    }
  }
}
```

## Showcases

Twelve interactive demos covering every native command and the look script:

```bash
deno task showcase             # arrow-key menu of all showcases
deno task showcase look-basic  # run one directly
deno task showcase --list      # list keys
```

## Develop

```bash
deno task test    # tests
deno task lint    # lint
deno task check   # type-check
```

See [CLAUDE.md](./CLAUDE.md) for the plugin authoring guide and
[CONTRIBUTING.md](./CONTRIBUTING.md) for code style and PR conventions.

## License

MIT — see [LICENSE](./LICENSE).
