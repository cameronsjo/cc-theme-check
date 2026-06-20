# Plan — cc-theme-check launcher: settings, autodetect, and a TUI front door

## Context

The forge work is shipped. `cc-theme-check` now has four cooperating modes
(verify, watch, edit, init) but the activation energy is still high:

1. **Repeated typing.** Users with a Ghostty theme have to pass `--ghostty
   <path>` every invocation to get an accurate canvas bg and ANSI palette.
   No tool memory between runs.
2. **Hidden modes.** A new user runs `cc-theme-check`, gets the one-shot
   verify, and may never discover that `--edit` exists.
3. **Manual context.** The tool can read `~/.claude/settings.json` to find
   the active theme, but doesn't autodetect any of the *terminal* context
   (Ghostty config, tmux, terminal name) — even though all three are sitting
   right there in env vars or the standard config path.

This plan adds three cooperating layers:

- **Autodetect** — read `~/.config/ghostty/config` for the active theme,
  sniff `$TERM_PROGRAM` and `$TMUX` for terminal context, surface it all in
  the header.
- **Settings file** — `~/.config/cc-theme-check/config.json` holds persistent
  defaults; CLI flags override.
- **Launcher TUI** — a new top-level Ink screen that opens by default in
  interactive sessions, picking between the existing four modes plus a
  settings editor. Falls back to one-shot verify when piped/scripted.

### Execution decisions (confirmed)

- **Bare invocation:** TTY-aware. `cc-theme-check` opens the launcher when
  stdin is a TTY; falls back to one-shot verify when piped, when a theme
  path arg is given, or when any explicit flag is set. Industry-standard
  pattern (lazygit, gh, modern fzf).
- **Ink as hard dependency:** user has confirmed they're fine with this.
  Collapses `peerDependenciesMeta` into plain `dependencies`. Removes the
  `ERR_MODULE_NOT_FOUND` lazy-load dance in `cli.mjs`. Updates
  CLAUDE.md's "default install stays chalk-only" rule.
- **Settings location:** `~/.config/cc-theme-check/config.json` (respects
  `XDG_CONFIG_HOME` if set). Plain JSON. First-run path treats missing file
  as `{}` — same pattern as init.mjs handles `~/.claude/settings.json`.
- **Branch:** all three phases land on a feature branch (`feat/launcher`),
  one commit per phase so they're reviewable independently.

---

## Phase 1 — Autodetect + settings (no UI change)

Pure infrastructure. The verifier and the existing modes start consuming
autodetected and persisted values; no flag UI changes.

### `src/config.mjs` (new, ~80 lines)

Loads/saves persistent settings. XDG-aware path resolution.

```javascript
const CONFIG_PATH = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
  'cc-theme-check',
  'config.json',
);

export function loadConfig() { /* ENOENT → {} */ }
export async function saveConfig(next) { /* mkdir -p + write */ }
export function configPath() { return CONFIG_PATH; }
```

Settings schema (all keys optional):

| Key | Type | Purpose |
|---|---|---|
| `ghosttyTheme` | string | Path *or* theme name (e.g. `"artificer-dark"`) — resolved against `~/.config/ghostty/themes/` |
| `bgOverride` | string | Hex color, overrides canvas bg |
| `themePath` | string | Override Claude Code theme auto-discovery |
| `defaultFlags` | object | `{ audit?, palette?, tokens?, all? }` — turn on by default |

No `defaultMode` key. The bare-invocation TTY-detection handles mode
selection without persistence (avoids surprising users who SSH in and
expect their menu to open).

### `src/autodetect.mjs` (new, ~60 lines)

Pure functions, no I/O side effects beyond the reads they perform.

```javascript
export function detectGhosttyTheme() {
  // Parse ~/.config/ghostty/config for `theme = <name>` line.
  // Resolve <name> against ~/.config/ghostty/themes/<name>.
  // Returns { path, themeName, configPath } or null if not found.
}

export function detectTerminal() {
  // Returns { name, isTmux, chalkClampReason }.
  // name from $TERM_PROGRAM ('Apple_Terminal' → 'Terminal.app', etc.).
  // isTmux from $TMUX env.
}
```

The Ghostty config parser is a tiny reuse of the pattern in `ghostty.mjs`
but for a different file (the `config` file, not theme files). Both files
use the same `key = value` ini-ish format, so the line-parsing helper can
move to a shared `src/ini.mjs` if it earns its keep — otherwise inline is
fine.

### Option resolution precedence

Encapsulate in a small helper used by `cli.mjs`, `watch.mjs`, and the
launcher:

```text
ghosttyPath: CLI flag > settings > autodetect > null
bgOverride:  CLI flag > settings > autodetect (Ghostty bg) > null
themePath:   CLI positional > settings > discoverTheme()
auditFlags:  CLI flag > settings.defaultFlags > false
```

Goes in `src/options.mjs` (new, ~40 lines): `resolveOptions(rawCliOpts) →
fullOpts`. Replaces the ad-hoc resolution scattered across `cli.mjs` and
`render-all.mjs::resolveCanvasBg`. `resolveCanvasBg` keeps its job (it
makes the final pick from the resolved bag); `resolveOptions` just gathers
the raw inputs.

### Header surfaces autodetect status

`src/render/header.mjs` gains two extra lines:

```text
  Terminal: Ghostty 1.2  ·  tmux: yes (chalk clamps to 256)
  Ghostty theme: artificer-dark (~/.config/ghostty/themes/artificer-dark)
```

Lines render only when the data is available. Dimmed style — they're
context, not content.

### Phase 1 files

| File | Action |
|---|---|
| `src/config.mjs` | new |
| `src/autodetect.mjs` | new |
| `src/options.mjs` | new |
| `src/cli.mjs` | call `resolveOptions()`, remove ad-hoc fallbacks |
| `src/render-all.mjs` | `resolveCanvasBg` consumes the resolved bag |
| `src/render/header.mjs` | render Terminal + Ghostty autodetect lines |
| `test/config.test.mjs` | new: XDG path resolution, ENOENT handling |
| `test/autodetect.test.mjs` | new: parse Ghostty config, tmux detection |
| `test/options.test.mjs` | new: precedence (flag > settings > detect > null) |

### Phase 1 verification

- `node src/cli.mjs` against the active theme — header shows the new
  Terminal + Ghostty lines auto-filled
- `unlink ~/.config/cc-theme-check/config.json; node src/cli.mjs` — works
  without errors (ENOENT first-run path)
- Write `{ "ghosttyTheme": "artificer-dark" }` to the config, run
  `cc-theme-check` — Ghostty palette flows through without the
  `--ghostty` flag
- CLI `--ghostty <path>` still wins over the settings value
- `npm test` — new tests pass

---

## Phase 2 — Launcher TUI (Ink becomes hard dep)

The visible feature. New top-level launcher composed of three panes plus a
keybind footer; the existing forge editor remains a separate Ink screen
launched from the menu.

### Behavior

```text
$ cc-theme-check                  → launcher TUI (TTY)
$ cc-theme-check | grep FAIL      → one-shot verify (piped — !isTTY)
$ cc-theme-check artificer.json   → one-shot verify (positional arg)
$ cc-theme-check --verify         → one-shot verify (explicit flag)
$ cc-theme-check --watch          → watch (existing flag — short-circuit)
$ cc-theme-check --edit           → forge (existing flag — short-circuit)
$ cc-theme-check --init           → init (existing flag — short-circuit)
$ cc-theme-check --menu           → launcher (force, even when piped)
```

TTY detection: `process.stdin.isTTY && process.stdout.isTTY`.

### Launcher layout

```text
┌─ cc-theme-check ──────────────────────────────────────────────────┐
│ ✦ Theme: custom:artificer  (~/.claude/themes/artificer.json)      │
│ Terminal: Ghostty 1.2  ·  tmux: yes (256)                         │
│ Ghostty theme: artificer-dark  ·  canvas bg: #1a1d2e              │
├───────────────────────────────────────────────────────────────────┤
│ MODE                                                               │
│ ───                                                                │
│ ❯ Verify                       One-shot render + WCAG summary      │
│   Watch                        Live reload on theme-file save      │
│   Forge                        Interactive TUI editor              │
│   New theme…                   Scaffold from boring-grey template  │
│                                                                    │
│ ─────                                                              │
│   Settings                     Configure defaults                  │
│   Quit                                                             │
└───────────────────────────────────────────────────────────────────┘
  [j/k] nav  [enter] run  [s] settings  [r] refresh  [q] quit
```

### Settings pane

Editable field grid. Shows current value AND its source (flag / settings
file / autodetect / default) so users see what's overriding what.

```text
┌─ Settings ─────────────────────────────────────────────────────────┐
│ Field                  Value                       Source           │
│ ─────                  ─────                       ──────           │
│ ❯ Ghostty theme        artificer-dark              autodetected     │
│   Canvas bg            #1a1d2e                     ghostty.config   │
│   Default audit        off                         default          │
│   Default palette      off                         default          │
│   Default tokens       off                         default          │
│   Theme path           ~/.claude/themes/...        discovered       │
│                                                                     │
│   [enter] edit  [d] delete (revert)  [s] save  [esc] back           │
└─────────────────────────────────────────────────────────────────────┘
```

`[d]` removes the key from the settings file so the value reverts to
autodetect/default. `[s]` writes the file.

### Architecture

The launcher reuses the captured-stdout pattern from the forge Preview
(ADR 0001) for any inline previews it shows. Mode launches use a clean
hand-off: launcher `unmount()`s itself, then `import()` and run the mode.
Avoids nesting Ink instances, which doesn't compose cleanly with the
forge's existing `render()` call.

```javascript
// src/menu/index.mjs
export async function launchMenu({ resolved }) {
  const { waitUntilExit, unmount } = render(<Menu resolved={resolved} />);
  const choice = await waitUntilExit();  // returns the user's pick
  unmount();
  switch (choice.action) {
    case 'verify': return runOnce(resolved.themePath, resolved.opts);
    case 'watch':  return import('../watch.mjs').then(m => m.watchAndRender(...));
    case 'forge':  return import('../forge/index.mjs').then(m => m.launchForge(...));
    case 'init':   return import('../init.mjs').then(m => m.runInit());
    case 'quit':   return;
  }
}
```

Components at `src/menu/components/`:

- `Menu.mjs` — root, header bar + mode list + footer
- `StatusBar.mjs` — Theme / Terminal / Ghostty rows from autodetect
- `ModeList.mjs` — vim-keyed list (reuses TokenList navigation pattern)
- `Settings.mjs` — field grid; reuses EditRow's TextInput pattern for hex
  fields, switches checkboxes via space for booleans

### Keybinds

| Key | Mode | Action |
|---|---|---|
| `j` / `↓` | menu | Move cursor down |
| `k` / `↑` | menu | Move cursor up |
| `enter` | menu | Run selected mode (or open Settings) |
| `s` | menu | Jump to Settings |
| `r` | menu | Refresh autodetect (re-read Ghostty config, env) |
| `q` | menu | Quit |
| `enter` | settings | Edit focused field |
| `d` | settings | Delete (revert) focused field to autodetect/default |
| `s` | settings | Save config to disk |
| `esc` | settings | Back to menu |

### Dependency migration

```json
// package.json
{
  "dependencies": {
    "chalk": "^5.4.0",
    "ink": "^7",
    "ink-text-input": "^6",
    "react": "^19"
  },
  // peerDependencies + peerDependenciesMeta removed
  // devDependencies for ink/react/ink-text-input removed
}
```

`src/cli.mjs` loses the `ERR_MODULE_NOT_FOUND` try/catch around the
`--edit` import; it can just `await import()` normally now.

`CLAUDE.md` updates:
- Remove the "default install stays chalk-only" line from the optional
  deps section
- Update "Out of scope" to remove the optional-deps note
- Add a brief note that Ink is the default UI layer

`README.md` updates:
- "Install" section: drop the "Optional: TUI forge dependencies" subsection
- Add a "Launcher" subsection above the "Usage" table
- Add a "Settings" subsection documenting `~/.config/cc-theme-check/config.json`

`CHANGELOG.md` adds an `Unreleased` → `Changed` entry: "Ink is now a hard
dependency. The peer-dep gating for `--edit` is gone; `npm install
cc-theme-check` pulls everything."

### Phase 2 files

| File | Action |
|---|---|
| `src/menu/index.mjs` | new — entry, launchMenu() |
| `src/menu/components/Menu.mjs` | new |
| `src/menu/components/StatusBar.mjs` | new |
| `src/menu/components/ModeList.mjs` | new |
| `src/menu/components/Settings.mjs` | new |
| `src/cli.mjs` | TTY detection branch, `--verify`, `--menu` flags, remove lazy-load |
| `package.json` | move ink/react/ink-text-input to dependencies |
| `CLAUDE.md` | update optional-deps and Out of scope sections |
| `README.md` | rewrite Install + add Launcher / Settings subsections |
| `CHANGELOG.md` | Unreleased / Changed entry for the Ink dep change |
| `docs/adr/0002-launcher-as-primary-interface.md` | new — records the bare-invocation + dep changes |
| `test/menu-state.test.mjs` | new — settings field editing, source tracking |

### Phase 2 verification

- `cc-theme-check` in a TTY → launcher opens, status bar shows autodetected
  Ghostty theme + tmux state
- `cc-theme-check | cat` → falls through to one-shot verify (TTY check)
- `cc-theme-check --verify` in TTY → one-shot, no menu
- `cc-theme-check --menu | cat` → launcher (force flag overrides piped)
- From the menu: pick Verify, hit `enter` → menu unmounts, verify renders
- From the menu: pick Settings, change Ghostty theme, save, return to menu,
  see the new source label
- `cat ~/.config/cc-theme-check/config.json` reflects the saved value
- `[d]` in settings removes the key, source reverts to `autodetected` or
  `default`
- `npm install -g .` from a fresh clone pulls Ink without prompting

---

## Phase 3 — Polish + ship

The cleanup pass that turns the merged work into a release.

- **CHANGELOG.md** — promote the Phase 1+2 entries to a v0.2.0 section,
  date it, bump `package.json` version
- **README.md** — rewrite the lead with the launcher screenshot (or
  text mockup); ensure the Settings table mirrors the schema in
  `src/config.mjs`
- **Out-of-scope statement** — add a one-liner: "We don't autodetect for
  iTerm2 / WezTerm yet — those terminals don't have a standard color
  config path. Use `--bg` / `--ghostty` explicitly."
- **Migration note** — anyone who installed pre-launcher with optional
  deps unset now gets Ink on next install. No code break, but worth
  calling out in the CHANGELOG.

### Phase 3 verification

- `git diff main` shows three coherent commits, one per phase
- `npm test` — full suite passes (Phase 1 added autodetect/config/options
  tests; Phase 2 added menu-state tests)
- `node src/cli.mjs --help` lists `--verify` and `--menu`
- Bare invocation from a fresh terminal opens the launcher
- README quickstart works end-to-end from a fresh `git clone && npm install
  && npm link`

---

## Critical files reference

### Modify

- `src/cli.mjs` (104 lines) — TTY check, drop ERR_MODULE_NOT_FOUND block,
  add `--verify` / `--menu` flags, route through `resolveOptions()`
- `src/render-all.mjs` — `resolveCanvasBg` consumes the resolved options
  bag instead of raw CLI opts
- `src/render/header.mjs` — render Terminal + Ghostty autodetect lines
- `package.json` — move peer deps to deps
- `README.md`, `CLAUDE.md`, `CHANGELOG.md` — see per-phase notes

### Create

- `src/config.mjs`, `src/autodetect.mjs`, `src/options.mjs` (Phase 1)
- `src/menu/index.mjs` + 4 components (Phase 2)
- `docs/adr/0002-launcher-as-primary-interface.md` (Phase 2)
- `test/config.test.mjs`, `test/autodetect.test.mjs`,
  `test/options.test.mjs`, `test/menu-state.test.mjs`

### Reuse unchanged

- `src/discover.mjs` — `discoverTheme()`, `loadTheme()`
- `src/ghostty.mjs` — `loadGhosttyTheme()` (parses theme files; the new
  config-file parsing lives in `src/autodetect.mjs`)
- `src/contrast.mjs`, `src/colorize.mjs`, `src/render/*.mjs`
- `src/watch.mjs`, `src/forge/`, `src/init.mjs` — launch targets, unchanged
- `src/debug.mjs` — the menu uses `debug()` for narrative logging just like
  the forge does

---

## Out of scope (intentional)

- **Terminal autodetect beyond `$TERM_PROGRAM`.** iTerm2 / WezTerm don't
  have a standard color-config path; we don't try to find one
- **Multi-profile settings.** No `~/.config/cc-theme-check/profiles/`. One
  config per user. If anyone wants per-project overrides later, they can
  add `--config <path>` then
- **Settings schema validation.** The settings file is small and the keys
  are stable; we trust the JSON and surface clear errors on bad values
  (e.g. invalid hex → keep the autodetect, write a warning to stderr)
- **Mini-preview inside the launcher.** Tempting, but adds complexity for
  little signal — the launcher is one keypress from a full preview

---

## Dependency strategy summary (post-Phase 2)

| Dep | Status | Used in |
|---|---|---|
| `chalk@^5` | required | All modes + autodetect colorization |
| `ink@^7` | required | Launcher + Forge |
| `react@^19` | required | Ink components |
| `ink-text-input@^6` | required | Settings + Forge hex input |

`peerDependencies` and `peerDependenciesMeta` keys removed from
`package.json`. Default install pulls everything needed for any mode.
