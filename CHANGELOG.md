# Changelog

All notable changes to `cc-theme-check` are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-05-16

### Added

- **Launcher TUI**: bare `cc-theme-check` now opens an interactive menu
  in a TTY — pick Verify, Watch, Forge, New theme, or Settings without
  remembering flags. Pipes and scripts still get the one-shot verifier
  via TTY detection (`process.stdin.isTTY && process.stdout.isTTY`),
  matching the pattern used by `lazygit`, `gh`, and modern `fzf`. See
  [ADR 0002](docs/adr/0002-launcher-as-primary-interface.md).
- **Settings pane** inside the launcher: edits
  `~/.config/cc-theme-check/config.json` with vim-style navigation,
  inline hex/text entry, boolean toggles, and live source labels
  (`flag` / `settings*` / `autodetect` / `default`) so you can see which
  override is winning. `[s]` saves, `[d]` reverts a field, `[esc]`
  returns to the menu.
- `--verify` flag: force one-shot verify even inside a TTY (skip the
  launcher).
- `--menu` flag: force the launcher even when piped (e.g. for demos).
- **Autodetect**: `cc-theme-check` now reads `~/.config/ghostty/config`
  automatically to pick up the active Ghostty theme — `--ghostty <path>`
  becomes optional when you have a `theme = <name>` line. Terminal name
  (from `$TERM_PROGRAM`) and tmux state (from `$TMUX`) surface in the
  header as dimmed context lines.
- **Persistent settings** at `~/.config/cc-theme-check/config.json`
  (respects `$XDG_CONFIG_HOME`). All keys optional:
  `ghosttyTheme` (path or theme-name), `bgOverride` (#hex),
  `themePath` (override Claude Code auto-discovery),
  `defaultFlags` (`{ audit?, palette?, tokens?, all? }`). Missing file
  is a first-run path — treated as `{}`, never an error.
- **Precedence resolver** in `src/options.mjs`: every user-tweakable
  field walks `CLI flag > settings > autodetect > default`. The
  resolved bag also exposes a `sources` map so the upcoming launcher
  UI can label which override won.
- **Shared INI parser** at `src/ini.mjs::parseIniLine(line)`. Both
  `autodetect.mjs` (parsing `~/.config/ghostty/config`) and
  `ghostty.mjs` (parsing theme files) now use it — eliminates the
  prior behavioral divergence where one parser silently skipped
  `key=value` without spaces while the other accepted it.
- `--watch` mode: live-reload the verifier on every theme-file save. Uses
  `fs.watch` on the parent directory + filename filter, so it survives
  editor-rename saves (write-to-`.tmp` + mv). Re-renders on terminal resize.
  50 ms debounce. Ctrl-C exits cleanly.
- `--edit` mode: Ink-based TUI forge with side-by-side preview. Token list on
  the left, captured-stdout chalk render on the right, hex input row with live
  WCAG feedback. Vim-style `j`/`k`/`h`/`l`, `enter` to edit, `s` to save,
  `u`/`U` for undo/redo, `/` to filter. Requires optional peer deps (`ink`,
  `react`, `ink-text-input`); missing deps print a clean install hint.
- `--init [slug]` mode: scaffold a new theme JSON from a starter template.
  TTY-aware prompts (no Ink dep), strict kebab-case slug validation, optional
  rewrite of `~/.claude/settings.json` to point at the new theme. Treats
  missing `settings.json` as a first-run signal rather than an error.
- `CC_THEME_CHECK_DEBUG=1` env var to opt into narrative logging
  (`Preparing… Successfully… Failed…`). Off by default — the verifier stays
  quiet unless explicitly asked.
- 96 unit tests covering contrast math, forge state reducer, init slug
  validation, layout helpers, and the token catalog. Runs via the built-in
  `node --test`.
- Real-Claude-Code-parity layout in the mock conversation: `⏺`/`●`
  platform-dependent tool dots, dimmed `⎿` result connector (no box around
  tool calls), permission-prompt box, model/tokens/branch/mode status footer,
  brief-mode speaker labels, and the ultrathink rainbow.

### Changed

- **Ink is now a hard dependency.** `ink`, `react`, and `ink-text-input`
  moved from `peerDependenciesMeta` optionals to required `dependencies`
  in `package.json`. `npm install cc-theme-check` pulls everything for
  every mode — no more "install peer deps for `--edit`" hint. Install
  footprint grew from ~200 KB to ~6 MB; the discoverability win is worth
  the bytes for a developer tool. Anyone who had been running with peer
  deps unset will get Ink on next install — no code break.
- Token coverage in the default mock conversation: ~15 → ~35 of the named
  catalog tokens are now exercised, so the contrast summary reflects what
  users actually see.

## [0.1.0] — 2026-05-14

### Added

- Initial release — single-mode verifier with header, mock conversation, and
  3-line WCAG contrast summary. Flags: `--audit`, `--tokens`, `--palette`,
  `--all`, `--ghostty <path>`, `--bg <#hex>`.
- Mirrors Claude Code's chalk pipeline (tmux clamp + xterm.js boost).
- sRGB-linearized WCAG contrast math.

[Unreleased]: https://github.com/cameronsjo/cc-theme-check/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/cameronsjo/cc-theme-check/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cameronsjo/cc-theme-check/releases/tag/v0.1.0
