# CLAUDE.md — cc-theme-check

A standalone CLI for verifying Claude Code themes. Generic by design — no
hardcoded theme assumptions, no project-specific defaults.

## Project shape

Plain Node ESM package. Runtime deps: `chalk@^5` for the verifier, plus
`ink` / `react` / `ink-text-input` for the launcher and the `--edit`
forge TUI — all hard `dependencies`. Entry point at `src/cli.mjs`
(executable, shebanged), exposed globally as `cc-theme-check` via
`package.json`'s `bin` field. See
[ADR 0002](docs/adr/0002-launcher-as-primary-interface.md) for the
launcher + dep-posture decision.

```
src/
  cli.mjs           Entry: arg parsing, TTY-aware mode routing (--verify, --menu)
  colorize.mjs      chalk pipeline (mirror of Claude Code's colorize.ts)
  config.mjs        Load/save ~/.config/cc-theme-check/config.json (XDG-aware)
  autodetect.mjs    Read ~/.config/ghostty/config + $TERM_PROGRAM/$TMUX
  options.mjs       Precedence resolver: flag > settings > autodetect > default
  ini.mjs           Shared parseIniLine(line) used by autodetect + ghostty
  contrast.mjs      sRGB linearization + WCAG ratio + audit log + wcagBucket
  discover.mjs      Auto-discover active theme from ~/.claude/settings.json
  ghostty.mjs       Parse Ghostty theme INI files (via ini.mjs)
  render-all.mjs    Shared render orchestration (runOnce + resolveCanvasBg)
  watch.mjs         --watch: fs.watch loop with debounce + resize re-render
  init.mjs          --init: TTY-aware prompter + template scaffolding
  templates/        Starter theme JSONs (boring greys, dark + light)
  menu/             Launcher TUI (bare-invocation default in a TTY)
    index.mjs       launchMenu() — render Menu, await pick, unmount, return choice
    components/     Ink components: Menu, StatusBar, ModeList, Settings
  forge/            --edit: Ink TUI
    index.mjs       launchForge() entry
    catalog.mjs     Token catalog (sections + flatten())
    state.mjs       Reducer + undo history (capped at 100)
    components/     Ink components: Forge, TokenList, Preview, EditRow, HelpFooter
  render/
    layout.mjs      WIDTH constant, stripAnsi/pad/rule/sectionHeader/glyphs
    header.mjs      Box-drawing header (surfaces autodetect lines)
    conversation.mjs  Mock Claude Code conversation (platform-aware glyphs)
    palette.mjs     ANSI 16-color grid + mock terminal content
    tokens.mjs      All 69 tokens with swatches
    audit.mjs       Contrast summary + WCAG breakdown + footer
```

## Hard rules

1. **Mirror Claude Code's chalk pipeline exactly.** `colorize.mjs` must
   keep parity with the upstream `src/colorize.ts` from Claude Code —
   particularly the tmux clamping (`process.env.TMUX && chalk.level > 2`)
   and xterm.js boost. If Claude Code changes how it picks chalk level,
   we update here. Otherwise the tool lies.

2. **No theme-specific defaults.** Fallback hex codes in token lookups
   should be **boring greys** (`#888888`, `#666666`) — never Artificer
   gold or any other accent. The tool is generic. Artificer is the
   guinea pig, not the standard.

3. **Progressive disclosure.** Default mode shows header + mock
   conversation + 3-line summary. Detail goes behind `--audit`,
   `--tokens`, `--palette`, `--all`. Don't add more sections to the
   default.

4. **Audit only foreground tokens.** Background-only tokens
   (`diffAdded`, `diffRemoved`) should resolve via a non-auditing
   helper (`tBg()` in conversation.mjs) so the contrast summary stays
   meaningful.

5. **WCAG math uses sRGB linearization.** Don't switch to naive RGB
   averaging — the ratios must match axe / Stark / Lighthouse, or the
   audit is misleading.

## Development

```bash
node src/cli.mjs                              # launcher TUI (or verify if piped)
node src/cli.mjs --verify                      # one-shot verify (skip launcher)
node src/cli.mjs --menu                        # force launcher even when piped
node src/cli.mjs --all                         # everything
node src/cli.mjs --tokens                      # all 69 tokens
node src/cli.mjs --audit                       # contrast breakdown
node src/cli.mjs --watch                       # live reload on theme-file save
node src/cli.mjs --edit                        # Ink TUI forge
node src/cli.mjs --init [slug]                 # scaffold a new theme
node src/cli.mjs --ghostty <path>              # bring your own ANSI palette
node src/cli.mjs path/to/theme.json            # specific file (skips launcher)
```

`npm install` pulls everything. No optional peer deps — Ink, React, and
ink-text-input are required.

## When adding a new token to the verifier

Claude Code tokens are defined in `src/colorize.ts` upstream. When a new
token appears:

1. Add it to the appropriate section in `render/tokens.mjs` (with a
   sample sentence that exercises its actual UI role)
2. If it's used in the mock conversation, add it to `render/conversation.mjs`
3. Use `t()` for foreground tokens (audits) or `tBg()` for backgrounds
   (skips audit)

## When upstream Claude Code changes its chalk pipeline

`colorize.mjs` is a mirror of Claude Code's `src/colorize.ts`. If the
upstream changes how it boosts/clamps chalk levels, update both
`boostChalkLevelForXtermJs()` and `clampChalkLevelForTmux()` to match.
The header banner in `render/header.mjs` reports the resolved level,
which is the user-visible signal that something is off.

## Settings + autodetect

`cc-theme-check` resolves every user-tweakable value through a precedence
chain in `src/options.mjs::resolveOptions()`:

```
CLI flag  >  settings file  >  autodetect  >  default
```

- **Settings** live at `~/.config/cc-theme-check/config.json` (respects
  `$XDG_CONFIG_HOME`). `src/config.mjs` handles load/save; missing file
  is a first-run path (`{}`), never an error.
- **Autodetect** in `src/autodetect.mjs` reads
  `~/.config/ghostty/config` for the active `theme = <name>` line,
  resolves the name against `~/.config/ghostty/themes/`, and sniffs
  `$TERM_PROGRAM` + `$TMUX` for the header.
- `resolveOptions` returns the raw CLI opts merged with the resolved
  values, plus an `autodetect: { ghostty, terminal }` bag for the
  header to surface and a `sources` map for the upcoming launcher UI
  to label which override won.

**Shared INI parser.** Both `ghostty.mjs` (theme files) and
`autodetect.mjs` (Ghostty config) parse the same `key = value` line
format. The helper lives in `src/ini.mjs::parseIniLine(line)` — splits
on the first `=`, trims both sides, skips `#` comments and blank
lines. Don't reintroduce a divergent inline parser.

## Modes

Bare `cc-theme-check` opens the launcher TUI in an interactive terminal
and falls back to the one-shot verifier when piped or scripted (TTY check
in `src/cli.mjs::shouldOpenMenu()`). `--verify` forces one-shot;
`--menu` forces the launcher. Beyond verify, three additional modes ride
the same render core:

- `--watch` — re-renders on every save to the theme file. Uses `fs.watch`
  on the parent directory so editor-rename saves still work. 50 ms
  debounce coalesces multi-write saves; also re-renders on terminal
  resize. Clean SIGINT exit.
- `--edit` — Ink-based TUI: side-by-side preview, j/k navigation, hex
  entry with live WCAG feedback, undo/redo, save-to-disk, filter mode.
  Ink is a hard dep — `import()` happens at the top level; no missing-deps
  path. Same goes for the launcher.
- `--init [slug]` — TTY-aware prompter scaffolding new themes from a
  starter template (dark or light, both monochrome greys). Optionally
  rewires `~/.claude/settings.json`. Handles both interactive TTY and
  piped stdin without hanging.

**Launcher (`src/menu/`).** Top-level Ink screen with header + mode list
+ settings pane. `launchMenu()` mounts, awaits a pick via callback,
unmounts, then `cli.mjs` dispatches to the chosen mode. Mode launches
happen *after* unmount so the forge's own `render()` doesn't nest. The
Settings pane edits `~/.config/cc-theme-check/config.json` with live
source labels (`flag` / `settings` / `autodetect` / `default`) so users
see which override won — same `resolveOptions()` precedence chain the
verifier uses.

**Shared render core.** The Preview pane in `--edit` reuses
`renderConversation()` by monkey-patching `process.stdout.write` during
the render pass and embedding the captured ANSI in an Ink `<Text>` node.
All four modes share one source of visual truth — fixing a layout bug in
conversation.mjs propagates everywhere.

**Forge state invariants:**
- Undo history capped at 100 snapshots (`HISTORY_CAP` in `state.mjs`).
- Save baselines against the *snapshot written*, not current state — so
  edits during the async `writeFile` don't silently mark themselves as
  saved. The Settings pane in the launcher follows the same invariant
  (snapshot passed via `SAVE_SUCCESS` action).
- Hex deletion via clearing the input — empty TextInput dispatches `''`
  (not `'#'`), letting `COMMIT_EDIT` hit the deletion branch.

## Out of scope

- **Validation against the schema.** Claude Code already errors out on
  bad theme JSON at load time. We render what's there.
- **Multi-terminal rendering.** Chalk handles the truecolor / 256 /
  basic distinction, and we report the resolved level. We don't try to
  emulate other terminals' rendering.
