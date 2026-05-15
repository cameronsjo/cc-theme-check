# Plan — Closer Claude Code parity + the cc-theme-check forge

## Context

`cc-theme-check` exists to verify Claude Code themes. Today it ships a chalk-based mock conversation that approximates the real Claude Code UI, but two gaps weaken the verification signal:

1. **The mock diverges from real Claude Code rendering.** It draws a box around the Edit tool call (`┌─ Edit src/parser.ts` … `└─ ✓ Applied`), uses `└─` instead of `⎿` for tool result connectors, and misses platform-dependent glyph swaps. A theme that looks good in the mock may not look right in the real client.

2. **The tool is one-shot.** Tweaking a theme means: edit JSON → run command → squint → edit JSON → run command. No live feedback, no exploratory mode, no interactive WCAG signal as you pick colors. The CLAUDE.md already anticipates this gap ("A future TUI editor (`--edit` flag, Ink-based) is planned but not started").

This plan closes both gaps: (1) bring the chalk renderer into structural alignment with the real Claude Code conversation, and (2) add a "forge" — a unified set of modes that turn the verifier into a live design tool.

CLAUDE.md hard rules still hold throughout: no theme-specific defaults, chalk pipeline mirrors upstream, foreground-only auditing, sRGB WCAG math, progressive disclosure. Ink/React must lazy-load so default install stays single-dep.

### Execution decisions (confirmed)

- **Branch:** all four phases land on a feature branch (`feat/forge` or similar), not on `main`. Each phase commits as one logical chunk so we can review/revert phase by phase.
- **Scope:** all four phases (Verify parity, Watch, Edit, Init) ship in this plan.
- **Optional deps for `--edit`:** declared via `peerDependenciesMeta` so default install stays chalk-only. Missing deps trigger a clean install hint, not a crash.

## Vision — The Forge

cc-theme-check becomes the forge for Claude Code themes. Four cooperating modes, all sharing the same render core:

| Mode | Flag | Purpose | New deps |
|---|---|---|---|
| **Verify** | (default) | One-shot render — faithfully tuned to match real Claude Code | none |
| **Watch** | `--watch` | Live reload — edit theme JSON in any editor, see the render update | none (`fs.watch`) |
| **Forge** | `--edit` | Ink TUI: side-by-side preview, inline WCAG, vim-style nav | optional: ink, react, ink-text-input |
| **Init** | `--init` | Scaffold a new theme from a starting template | none |

`--edit` is the only mode that pulls ink/react, declared via `peerDependenciesMeta` so default install stays chalk-only. Running `--edit` without the deps prints a clean install hint and exits.

---

## Phase 1 — Layout fidelity (no new deps)

Bring `src/render/conversation.mjs` into structural alignment with what Claude Code actually renders today.

### Tool use prefix — drop the box

Real Claude Code renders tool calls as a colored dot + bold name with **no surrounding box**. Boxes are reserved for permission prompts and (sometimes) diffs.

Replace:
```text
┌─ Edit src/parser.ts
   <diff lines>
└─ ✓ Applied
```

With:
```text
⏺ Edit(src/parser.ts)
  <diff lines, indented 2 spaces>
  ⎿  ✓ Applied
```

- Glyph: `⏺` (U+23FA) on `process.platform === 'darwin'`, `●` (U+25CF) elsewhere
- Color: `claude` token (audits against canvas bg)
- Tool name: bold via chalk; arg in parens, color `inactive`
- Connector `⎿` (U+23BB): dim-styled via chalk; result content takes `success`/`error`/text tokens

### Tool result connector everywhere

Use `  ⎿  ` (2 spaces + connector + 2 spaces) for every tool result summary. Apply chalk dim to the connector glyph itself. Result content uses domain-appropriate tokens (`success`, `error`, plain `text`).

### Add tool calls that exercise dead tokens

The token list has 56 named tokens but the current mock exercises only ~15. Add concrete tool calls that pull in unused tokens:

- **Bash invocation** — exercises `bashBorder` and `success`
  ```
  ⏺ Bash(npm test)
    ⎿  ✓ 42 tests passed
  ```

- **Read tool** — typical Claude Code pattern, dimmed connector with line count
  ```
  ⏺ Read(src/parser.ts)
    ⎿  Read 145 lines
  ```

- **Subagent dispatch** — exercises `*_FOR_SUBAGENTS_ONLY` tokens
  ```
  ⏺ Task(Explore — survey repo)
    ⎿  Done (12 tool uses)
  ```
  Color the agent name with a subagent token (e.g. `blue_FOR_SUBAGENTS_ONLY`).

- **Permission prompt** — the legitimate place for a box. Exercises `permission`, `userPromptBorder`-family tokens
  ```
  ╭─ Edit ─────────────────────────────╮
  │ Allow Edit on src/parser.ts?       │
  │  ❯ 1. Yes                          │
  │    2. Yes, and don't ask again     │
  │    3. No                           │
  ╰────────────────────────────────────╯
  ```

- **Ultrathink rainbow** — real Claude Code rainbow-colors the literal word "ultrathink" in user prompts to confirm parse. Add a prompt containing the word and apply `rainbow_red` → `rainbow_violet` letter by letter. Exercises 14 otherwise-dead rainbow tokens.

### Dynamic-looking status footer

Replace today's abstract `● ✓ ⚠ ✗ ◆` status row with a real-Claude-Code-style footer line:

```text
─────────────────────────────────────────────────
  claude-opus-4-7 │ 12.4k tokens │ ⎇ main │ ⏵⏵ auto-accept
```

Tokens exercised: `inactive` (model name), `subtle` (separators), `autoAccept` (badge), `success` (token count). The badge text rotates between `planMode`/`autoAccept`/`fastMode` over multiple runs is **out of scope**; the static footer with one badge is enough for verification.

### Brief mode speaker labels

Add a compact `You:` / `claude:` header above the turn block to exercise `briefLabelYou` and `briefLabelClaude` (currently visible only in the tokens grid).

### Token coverage outcome

Before Phase 1: ~15 of 56 named tokens audited via conversation render.
After Phase 1: ~35 of 56. The contrast summary becomes meaningful for the colors users actually see in the wild.

### Phase 1 files

- `src/render/conversation.mjs` — rewrite (~57 → ~110 lines)
- `src/render/layout.mjs` — add `glyphs()` helper returning `{ toolDot, connector, ... }` based on `process.platform`
- `README.md` — update sample output

---

## Phase 2 — `--watch` mode (no new deps)

The forge starts with the cheapest possible win: file-watch live reload.

### Behavior

```bash
cc-theme-check --watch                 # watch the discovered theme file
cc-theme-check --watch path/to.json    # watch a specific path
cc-theme-check --watch --all           # watch with full audit/tokens/palette
```

- On launch: clear screen, render once, show `↻ watching <path>` indicator
- `fs.watch` (via `node:fs/promises` async iterator) fires on every save → clear screen, re-read theme, re-render
- `process.stdout.on('resize')` triggers re-render on terminal resize
- `SIGINT` exits cleanly, cursor restored

### Implementation

New module `src/watch.mjs` (~50 lines):

```javascript
import { watch } from 'node:fs/promises';

export async function watchAndRender(themePath, opts) {
  const ac = new AbortController();
  process.on('SIGINT', () => { ac.abort(); process.exit(0); });
  process.stdout.on('resize', () => renderAll(themePath, opts));

  await renderAll(themePath, opts);
  for await (const event of watch(themePath, { signal: ac.signal })) {
    if (event.eventType === 'change') await renderAll(themePath, opts);
  }
}
```

Requires extracting the current render flow from `src/cli.mjs` into a reusable `renderAll(themePath, opts)` function — straightforward refactor.

### Phase 2 files

- `src/watch.mjs` — new
- `src/cli.mjs` — `--watch` flag, extract `renderAll()`

---

## Phase 3 — `--edit` Ink TUI forge (optional deps)

The ambitious mode: a real interactive editor, vim-keyed, with side-by-side preview using the **same chalk renderer** the rest of the tool already uses.

### Key insight that simplifies everything

`renderConversation()` already produces an ANSI-coded string. Ink renders ANSI passthrough inside `<Text>` nodes. We do not rewrite the renderer for Ink — every state change re-runs the existing chalk render with new overrides and dumps the result into the preview pane.

### Layout

```text
╭─ forge ──────── ~/.claude/themes/artificer.json [modified] ──────╮
│ TOKENS                            │ PREVIEW                       │
│ ─────                              │ ───────                        │
│ ▾ Prompt Borders                  │ You: Help fix the parser bug. │
│   promptBorder    ████  #B0B9F9   │                               │
│   bashBorder      ████  #F5A623   │ ⏺ Edit(src/parser.ts)         │
│ ▸ Speaker Labels                  │   ⎿  ✓ Applied                │
│ ▸ Status Indicators               │ ⏺ Bash(npm test)              │
│ ▾ Diff View                       │   ⎿  ✓ 42 tests passed        │
│   diffAdded       ▓▓▓▓  #1a3a20   │                               │
│ ► diffAddedWord   ▓▓▓▓  #2d5a3a   │ claude-opus-4-7 │ 12.4k │ main│
│                                    │                               │
│ ─ EDIT: diffAddedWord ──────────  │                               │
│   #2d5a3a → #_______              │                               │
│   WCAG: 4.8:1 (AA) on #1a3a20     │                               │
╰────────────────────────────────────┴───────────────────────────────╯
  [j/k] move  [enter] edit  [s] save  [u] undo  [/] search  [q] quit
```

### Architecture

State store at `src/forge/state.mjs`:
- `overrides: Record<string, string>` (mutable working copy)
- `cursor: { section, tokenIndex }`
- `edit: null | { tokenKey, draftHex }`
- `history: overrides[]` (undo stack)
- `dirty: boolean`

Components at `src/forge/components/`:
- `Forge.mjs` — root, three-pane layout
- `TokenList.mjs` — left pane, collapsible sections, focused row highlight
- `Preview.mjs` — right pane, runs `renderConversation(overrides, canvasBg)` on every render and embeds the ANSI string
- `EditRow.mjs` — bottom-left, hex input via `ink-text-input` + live WCAG via `contrastRatio()` (reuses existing `src/contrast.mjs`)
- `HelpFooter.mjs` — keybind reminder

### Keybinds

| Key | Action |
|---|---|
| `j` / `k` | Move down/up in token list |
| `h` / `l` | Collapse/expand section |
| `enter` | Begin editing focused token |
| `esc` | Cancel edit |
| `enter` in edit mode | Commit hex |
| `s` | Save overrides back to theme JSON |
| `u` / `ctrl-r` | Undo / redo |
| `/` | Filter token list by name |
| `?` | Help overlay |
| `q` | Quit (prompts if dirty) |

### Lazy-load pattern

In `src/cli.mjs`:

```javascript
if (opts.edit) {
  try {
    const { launchForge } = await import('./forge/index.mjs');
    await launchForge({ themePath, overrides, canvasBg });
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('--edit requires ink and react. Install with:');
      console.error('  npm install -g ink react ink-text-input');
      process.exit(1);
    }
    throw err;
  }
  return;
}
```

`src/forge/index.mjs` does the `import 'ink'` / `import 'react'` calls. If those packages aren't installed, the import throws `ERR_MODULE_NOT_FOUND` and we catch it cleanly.

### package.json

```json
{
  "peerDependencies": {
    "ink": "^5",
    "react": "^18",
    "ink-text-input": "^6"
  },
  "peerDependenciesMeta": {
    "ink":            { "optional": true },
    "react":          { "optional": true },
    "ink-text-input": { "optional": true }
  }
}
```

Default `npm install -g cc-theme-check` does not pull these. README documents the upgrade path.

### Phase 3 files

- `src/cli.mjs` — `--edit` flag, lazy import block
- `src/forge/index.mjs` — entry, `launchForge()`
- `src/forge/state.mjs` — state store + history
- `src/forge/components/Forge.mjs`
- `src/forge/components/TokenList.mjs`
- `src/forge/components/Preview.mjs`
- `src/forge/components/EditRow.mjs`
- `src/forge/components/HelpFooter.mjs`
- `src/render/conversation.mjs` — minor: ensure it `return`s the string (today it `console.log`s); cli.mjs absorbs the print
- `package.json` — peerDependenciesMeta
- `README.md` — `--edit` section + install hint
- `CLAUDE.md` — move "TUI editor" from "Out of scope" to "Implemented"

---

## Phase 4 — `--init` scaffolding

Lower the activation energy for new theme authors. Plain `readline` prompts, no Ink dep.

```bash
cc-theme-check --init               # interactive prompts
cc-theme-check --init my-theme      # name supplied, defaults applied
```

Flow:
1. Pick a slug (kebab-case)
2. Pick a base (`dark` / `light`)
3. Pick a starting template (`minimal` empty overrides, or `from-active` copy of current theme)
4. Write `~/.claude/themes/{slug}.json`
5. Prompt: update `~/.claude/settings.json` to use `custom:{slug}`? [y/N]
6. Optionally launch `--edit` or `--watch` on the new file

### Phase 4 files

- `src/init.mjs` — ~80 lines
- `src/templates/dark.json`, `src/templates/light.json` — starter templates with full token list pre-populated with **boring greys** (per CLAUDE.md "no theme-specific defaults" rule)

---

## Critical files reference

### Modify
- `src/cli.mjs` (99 lines) — add flags `--watch`, `--edit`, `--init`; extract `renderAll()` helper
- `src/render/conversation.mjs` (57 lines) — Phase 1 rewrite for parity
- `src/render/layout.mjs` (24 lines) — add `glyphs()` platform helper
- `package.json` — peerDependenciesMeta block
- `README.md` — new modes + install hints
- `CLAUDE.md` — update Out of scope section

### Create
- `src/watch.mjs` (Phase 2)
- `src/forge/index.mjs` + `state.mjs` + `components/*.mjs` (Phase 3)
- `src/init.mjs` + `src/templates/{dark,light}.json` (Phase 4)

### Reuse unchanged
- `src/colorize.mjs` — `cfg()`, `cbg()` chalk helpers
- `src/contrast.mjs` — `tok()`, `auditContrast()`, `wcagBadge()`, `contrastRatio()` (Phase 3 EditRow calls `contrastRatio()` directly for live WCAG feedback)
- `src/discover.mjs` — `discoverTheme()`, `loadTheme()` (Watch and Edit call these)
- `src/render/{header,palette,tokens,audit}.mjs` — Watch and Edit invoke these unchanged

---

## Verification

### Phase 1 (layout fidelity)
- `node src/cli.mjs` against the active theme — visual compare against a real Claude Code session. Tool prefix is `⏺` on darwin (no surrounding box), result connector is `⎿`, footer shows model/tokens/branch/badge
- `node src/cli.mjs --audit` — confirm audited-token count increased from ~15 to ~35
- `--all` still renders palette + tokens + audit sections
- Edge: run with `process.platform` patched to `linux` — confirm `●` swaps in for `⏺`

### Phase 2 (watch)
- `node src/cli.mjs --watch` — edit the theme file in another terminal, save, confirm re-render fires within ~50ms
- Resize terminal — confirm re-render fires
- Ctrl-C exits cleanly, cursor visible

### Phase 3 (edit)
- Without ink installed: `node src/cli.mjs --edit` prints install hint, exits 1
- With ink installed: TUI launches, `j`/`k` moves cursor, `enter` opens edit row, hex typing updates preview live, WCAG ratio updates as user types, `s` writes JSON to disk (verify with `cat ~/.claude/themes/{active}.json`)
- Undo: edit a token → `u` → confirm value reverts
- Dirty quit: edit → `q` → confirm save prompt fires
- Lazy-load: confirm `node -e "import('./src/cli.mjs')"` does not error if ink is absent

### Phase 4 (init, if shipped)
- `cc-theme-check --init test-theme` writes `~/.claude/themes/test-theme.json`, declines settings.json update on `N`, exits cleanly with no orphaned state
- File contains all token keys with boring-grey defaults (no Artificer gold)

---

## Dependency strategy summary

| Dep | Status | Used in |
|---|---|---|
| `chalk@^5` | required | All modes |
| `ink@^5` | optional (peerDependenciesMeta) | `--edit` only |
| `react@^18` | optional | `--edit` only |
| `ink-text-input@^6` | optional | `--edit` hex input |

Default install footprint unchanged. `--edit` users see a clear install hint on first launch without deps. Honors CLAUDE.md's lazy-load constraint.
