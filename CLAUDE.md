# CLAUDE.md — cc-theme-check

A standalone CLI for verifying Claude Code themes. Generic by design — no
hardcoded theme assumptions, no project-specific defaults.

## Project shape

Plain Node ESM package. Single dependency: `chalk@^5`. Entry point at
`src/cli.mjs` (executable, shebanged), exposed globally as
`cc-theme-check` via `package.json`'s `bin` field.

```
src/
  cli.mjs           Entry: arg parsing, mode routing
  colorize.mjs      chalk pipeline (mirror of Claude Code's colorize.ts)
  contrast.mjs      sRGB linearization + WCAG ratio + audit log
  discover.mjs      Auto-discover active theme from ~/.claude/settings.json
  ghostty.mjs       Parse Ghostty theme INI files
  render/
    layout.mjs      WIDTH constant, pad/rule/sectionHeader helpers
    header.mjs      Box-drawing header
    conversation.mjs  Mock Claude Code conversation
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
node src/cli.mjs                              # default mode
node src/cli.mjs --all                         # everything
node src/cli.mjs --tokens                      # all 69 tokens
node src/cli.mjs --audit                       # contrast breakdown
node src/cli.mjs --ghostty <path>              # bring your own ANSI palette
node src/cli.mjs path/to/theme.json            # specific file
```

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

## Out of scope

- **Theme editing.** Only verification. A future TUI editor (`--edit`
  flag, Ink-based) is planned but not started — it would lazy-load
  `ink` + `react` so default CLI stays single-dep.
- **Validation against the schema.** Claude Code already errors out on
  bad theme JSON at load time. We render what's there.
- **Multi-terminal rendering.** Chalk handles the truecolor / 256 /
  basic distinction, and we report the resolved level. We don't try to
  emulate other terminals' rendering.
