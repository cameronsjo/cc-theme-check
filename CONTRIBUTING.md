# Contributing to cc-theme-check

Thanks for the interest. This is a small, focused tool with strong opinions
about scope — read the hard rules below before opening a PR.

## Dev setup

```bash
git clone https://github.com/cameronsjo/cc-theme-check.git
cd cc-theme-check
npm install
node src/cli.mjs                   # smoke-test against your active theme
npm test                           # 96 unit tests
```

The default install pulls only `chalk`. Ink/React/ink-text-input are listed as
**optional** peer deps and ship in `devDependencies` for `--edit` development.
A `npm install -g cc-theme-check` from a downstream user will not pull them.

## Hard rules (from `CLAUDE.md`)

1. **Mirror Claude Code's chalk pipeline exactly.** `src/colorize.mjs` is a
   port of the upstream `src/colorize.ts`. Keep tmux clamping and xterm.js
   boost in sync — if Claude Code changes how it picks chalk level, we update.
2. **No theme-specific defaults.** Fallback hex codes in token lookups are
   boring greys (`#888`, `#666`, `#333`). Never gold, never blue, never any
   accent. The tool is generic. Artificer is the guinea pig.
3. **Progressive disclosure.** Default mode = header + mock conversation +
   3-line summary. Detail lives behind `--audit`, `--tokens`, `--palette`,
   `--all`. Don't add new sections to the default.
4. **Audit only foreground tokens.** Background-only tokens (`diffAdded`,
   `diffRemoved`) resolve via the non-auditing `tBg()` helper.
5. **WCAG math uses sRGB linearization.** Don't switch to naive RGB
   averaging — the ratios must match axe / Stark / Lighthouse.

## Adding a new token

When a token appears upstream in Claude Code's `src/colorize.ts`:

1. Add it to the appropriate section in `src/render/tokens.mjs` with a sample
   sentence that exercises its real UI role.
2. If the mock conversation should exercise it, add it to
   `src/render/conversation.mjs`.
3. Use `t()` for foreground tokens (audited) or `tBg()` for backgrounds
   (skipped from audit).

## Testing

```bash
npm test                           # all tests
node --test test/contrast.test.mjs # one file
```

Tests use the built-in `node --test` runner — no Jest, no Vitest, no extra
deps. Keep it that way.

For visual checks:

```bash
node src/cli.mjs                   # default
node src/cli.mjs --all             # everything
node src/cli.mjs --watch           # live-reload
CC_THEME_CHECK_DEBUG=1 node src/cli.mjs --watch   # with narrative logging
```

The `--edit` mode requires the optional peer deps:

```bash
npm install ink react ink-text-input
node src/cli.mjs --edit
```

## Commits & PRs

- Conventional-style prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)
  are appreciated but not enforced.
- Keep PRs scoped — one logical change per branch.
- `npm test` must pass.
- If you're touching the renderer, include a before/after screenshot.

## Out of scope

These have been considered and intentionally excluded:

- Theme schema validation. Claude Code already errors on bad JSON at load
  time. We render whatever's there.
- Multi-terminal rendering emulation. Chalk handles truecolor / 256 / basic
  and we report the resolved level. We don't try to fake how iTerm renders
  what Ghostty renders.
- Theme-specific opinions. No "recommended" palettes, no curated presets.

If you want one of these, open an issue first to discuss.

## Architecture notes

- **One render core, four modes.** Verify, watch, edit, and init all share
  `src/render/conversation.mjs`. The Ink TUI's preview captures
  `process.stdout.write` during the render pass and embeds the resulting ANSI
  in an Ink `<Text>` node — Ink passes the escape codes through unmodified.
  See `docs/adr/0001-shared-render-core-via-captured-stdout.md` for the
  full rationale.
- **Optional deps via `peerDependenciesMeta`.** Default install stays
  single-dep. The `--edit` path uses dynamic `import()` and catches
  `ERR_MODULE_NOT_FOUND` to print a clean install hint.
- **Debug logging.** `src/debug.mjs` is the one place chatty narrative
  logging lives. Gated behind `CC_THEME_CHECK_DEBUG=1` so the default CLI
  experience stays quiet.
