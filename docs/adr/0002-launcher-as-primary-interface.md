# ADR 0002 — Launcher TUI as the primary interface

- Status: Accepted
- Date: 2026-05-16
- Decision driver: Cameron Sjo (`@cameronsjo`)

## Context

`cc-theme-check` shipped with a flag-driven CLI: `--audit`, `--watch`,
`--edit`, `--init`. Discovery was poor — a new user ran the bare command,
saw the verifier output, and had no clue the forge editor or live watch
existed. The optional-peer-dep gating on `--edit` made the situation
worse: even a curious user who typed `cc-theme-check --edit` saw
"requires ink, react, ink-text-input" and bailed.

Two related questions:

1. **What does bare `cc-theme-check` do once a launcher TUI exists?**
2. **Are Ink/React optional or required?**

The previous design treated Ink as optional via `peerDependenciesMeta`,
keeping the default install at one runtime dep (`chalk`). That decision
was load-bearing for a CLI-first identity, but it forces every TUI mode
behind a lazy `import()` + an install hint, which is awkward once
multiple modes need Ink.

## Decision

**Bare `cc-theme-check` opens a launcher TUI when running interactively,
falls back to one-shot verify when piped or scripted. Ink, React, and
ink-text-input move from optional peer-deps to required dependencies.**

### Bare-invocation routing

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

TTY detection: `process.stdin.isTTY && process.stdout.isTTY`. Implementation
in `src/cli.mjs::shouldOpenMenu(raw)`. Industry-standard pattern — `lazygit`,
`gh`, modern `fzf` all behave this way.

### Dependency posture

```json
{
  "dependencies": {
    "chalk": "^5.4.0",
    "ink": "^7.0.3",
    "ink-text-input": "^6.0.0",
    "react": "^19.2.6"
  }
}
```

`peerDependencies` and `peerDependenciesMeta` keys removed.
`devDependencies` for these packages also removed (they're regular
deps now).

`src/cli.mjs` loses the `ERR_MODULE_NOT_FOUND` try/catch around the
`--edit` import — no missing-deps path remains. The launcher itself
imports Ink/React unconditionally at the top level of `src/menu/index.mjs`.

## Consequences

### Positive

- **Discovery.** A new user sees four modes the moment they run the tool.
  No flag spelunking.
- **Settings UX.** The launcher's Settings pane edits
  `~/.config/cc-theme-check/config.json` with live source labels
  (`flag` / `settings` / `autodetect` / `default`) — surfacing the
  precedence chain so users understand what's overriding what.
- **No more `--edit` install hint.** Ink is always there; the forge
  works on first run.
- **Single source of visual truth.** The captured-stdout pattern from
  ADR 0001 still applies — Verify/Watch/Forge/Init all share the same
  chalk renderer, and the launcher just composes their entry points.

### Negative

- **Install footprint grew.** Default `npm install -g cc-theme-check`
  now pulls ink + react + ink-text-input (~6 MB of `node_modules`
  vs. the previous ~200 KB). Acceptable for a developer tool, but
  noticeably bigger.
- **Scripts that ran `cc-theme-check` and parsed stdout still work**
  thanks to the TTY check, **but** scripts running it inside a PTY
  wrapper (`script`, `expect`) without a real piped stream may now
  open the launcher unexpectedly. `--verify` is the escape hatch.
- **No more chalk-only fallback.** A user who wanted to use the
  verifier on a system where Ink can't install (very old Node,
  alpine without certain libs) has no path. We accept that cost —
  Ink supports Node ≥18, which is our minimum anyway.

## Alternatives considered

1. **Keep Ink optional; add `--menu` flag for launcher.** Rejected —
   forces existing problems (discovery, install hint friction) to
   persist for the dominant user. The optional posture was load-bearing
   only when Ink had no other use; with three modes (forge, launcher,
   future menu features) needing it, the optionality is more
   bookkeeping than value.

2. **Always open launcher.** Rejected — breaks `cc-theme-check |
   grep FAIL` workflows and CI use, which are real even if a minority.
   TTY detection is the same engineering cost for a much better
   default behavior.

3. **Detect via heuristics (`process.env.CI`, etc.).** Rejected —
   `process.stdin.isTTY && process.stdout.isTTY` is the canonical
   industry pattern. Heuristics drift; TTY check doesn't.

## References

- `src/cli.mjs::shouldOpenMenu()` — the TTY gate
- `src/menu/index.mjs::launchMenu()` — entry, callback-resolves a Promise
- `src/menu/components/Menu.mjs` — root composer
- `docs/adr/0001-shared-render-core-via-captured-stdout.md` — sibling
  decision the launcher composes on top of
