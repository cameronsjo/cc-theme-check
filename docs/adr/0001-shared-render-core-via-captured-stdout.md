# ADR 0001 — Shared render core via captured stdout

- Status: Accepted
- Date: 2026-05-15
- Decision driver: Cameron Sjo (`@cameronsjo`)

## Context

`cc-theme-check` ships four cooperating modes:

| Mode | Flag | Surface |
|---|---|---|
| Verify | (default) | chalk → stdout |
| Watch | `--watch` | chalk → stdout, re-run on file change |
| Forge | `--edit` | Ink TUI, side-by-side preview |
| Init | `--init` | scaffold + handoff to verify/edit |

Three of the four are plain stdout writers using `chalk`. The fourth, `--edit`,
is an Ink-based TUI that renders React components into the terminal. Ink owns
stdout once it starts: it maintains its own alternate-screen buffer, performs
its own diffing, and any raw `process.stdout.write` calls below the buffer
corrupt the layout.

A naive implementation of `--edit` would mean rewriting the mock conversation —
the diff-tinted Edit tool block, the `⏺`/`●` glyphs, the dimmed `⎿`
connectors, the ultrathink rainbow, the permission box, the model/tokens
status footer — as Ink JSX. That's:

- ~400 lines of duplication
- two render paths to keep in sync as upstream Claude Code evolves
- two contrast-audit code paths
- two ANSI level resolution paths

It also produces a guarantee mismatch: the `--edit` preview would render
**Ink's idea** of what the theme looks like, not what `cc-theme-check`'s own
verifier — and by extension Claude Code itself — renders.

## Decision

**Run the existing chalk renderer once per state change, capture its stdout
into a string, and embed that string in an Ink `<Text>` node.**

Ink passes ANSI escape sequences through `<Text>` unmodified — `\x1b[31m`
stays `\x1b[31m` and the terminal still interprets it as red. This means the
preview pane sees the same ANSI bytes the verifier would have printed, with
the same chalk pipeline, the same tmux clamp, the same xterm.js boost, the
same audit traversal.

Implementation (`src/forge/components/Preview.mjs`):

```js
function captureConversation(overrides, canvasBg, ghosttyTheme) {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  process.stdout.write = (chunk) => { buf += String(chunk); return true; };
  try {
    resetAudit();
    renderConversation(overrides, canvasBg, ghosttyTheme);
  } finally {
    process.stdout.write = orig;
  }
  return buf;
}
```

Wrapped in `React.useMemo` keyed by overrides + canvas + ghostty theme so the
expensive ANSI rebuild only fires on relevant state changes, not on every
keystroke in the hex input.

## Consequences

### Positive

- **One source of visual truth.** A fix to `src/render/conversation.mjs`
  propagates to verify, watch, **and** the `--edit` preview with zero
  duplication. The forge cannot drift from the verifier.
- **Tokens stay in one place.** `src/contrast.mjs::t()` audits foreground
  tokens; the audit log resets between renders via `resetAudit()`. The TUI
  picks up the same audit results for the WCAG line in the edit row.
- **Optional deps stay optional.** The shared core has zero Ink/React
  dependency — `--watch` and verify never touch the captured-stdout path.
- **Test surface stays small.** Render tests can hit the chalk path
  directly; we don't need Ink's `ink-testing-library` for visual parity
  coverage.

### Negative

- **Monkey-patching `process.stdout.write` is global.** Anything else
  writing to stdout during the render pass (a stray `console.log` from a
  dependency, an exception logger) gets captured into the buffer instead of
  reaching the user. Mitigated by:
  - keeping the patch window as narrow as possible (one synchronous render
    call, inside a `try/finally`),
  - routing internal narrative logging through `src/debug.mjs` → `stderr`,
    so even when `CC_THEME_CHECK_DEBUG=1` it doesn't pollute the buffer.
- **`renderConversation()` must be synchronous.** If it ever needs to
  `await` something, the patch window leaks. Today it's pure chalk + string
  concatenation, so this isn't a real constraint, but it's a load-bearing
  property worth knowing.
- **No partial re-render.** The preview rebuilds the entire ANSI string on
  every state change. At ~60 lines and ~6 ms per render this is invisible
  to the user; if we ever need pane-level granularity, that's the seam to
  rework.

## Alternatives considered

1. **Rewrite the renderer as Ink components.** Rejected — duplication cost
   outweighed any benefit. Would also force chalk semantics through Ink's
   prop system (`<Text color="..." backgroundColor="..." bold dimColor>`),
   which doesn't compose cleanly for ANSI 256 / truecolor distinctions.
2. **Render to a temp file and read it.** Rejected — adds I/O to the hot
   path, makes the render pipeline async, and gains nothing the in-memory
   buffer doesn't already give us.
3. **Two parallel renderers behind an interface.** Rejected — three modes
   would use the chalk one, one mode the Ink one. The "shared interface"
   would mostly be ceremony around `renderConversation(overrides)`. The
   abstraction earns its keep only if both implementations actually exist.

## References

- `src/forge/components/Preview.mjs` — the capture
- `src/render/conversation.mjs` — the shared render
- `src/contrast.mjs::resetAudit()` — the audit reset hook
- `src/forge/components/EditRow.mjs` — consumer of the audit results
