# cc-theme-check

Verify your Claude Code theme renders the way you expect — without restarting Claude Code 50 times to find out.

```
cc-theme-check
```

Auto-discovers your active theme from `~/.claude/settings.json`, renders a mock conversation using the **same chalk pipeline Claude Code uses internally**, and reports a 3-line WCAG contrast summary.

```
  You: Help me fix the parser. Please ultrathink this one.

  ◆ Thinking…

  ⏺ Read(src/parser.ts)
    ⎿  Read 145 lines

  ⏺ Edit(src/parser.ts)
        function parse(input) {
    +     if (!input) return { tokens: [], ok: true };
        const result = parse(rawInput);
    -   const result = oldParse(rawInput);
    ⎿  ✓ Applied

  ⏺ Bash(npm test)
    ⎿  ✓ 42 tests passed

  claude-opus-4-7 │ 12.4k tokens │ ⎇ main │ ⏵⏵ auto-accept

  13 AA  6 aa  3 FAIL  run --audit for details
```

The mock conversation mirrors what Claude Code actually renders today — `⏺`/`●` tool dots (platform-dependent), `⎿` dimmed result connectors, permission-prompt boxes where they belong, and a `model │ tokens │ branch │ mode` status footer.

## Why

Claude Code themes are 69 tokens of hex codes in a JSON file. Most theme authors discover problems the same way:

1. Edit `theme.json`
2. Restart Claude Code
3. Squint at the prompt
4. Notice the diff colors are unreadable
5. Repeat

`cc-theme-check` shortcuts that loop. It also surfaces things you can't easily see by squinting:

- **WCAG AA contrast** for every token against your terminal background
- **Chalk level** — Claude Code clamps to 256-color in tmux (this catches most "the colors look wrong" reports)
- **ANSI palette flow-through** — Claude Code falls back to your terminal's ANSI palette for code highlighting, comments, and a few other surfaces

## Install

```bash
git clone https://github.com/cameronsjo/cc-theme-check.git
cd cc-theme-check
npm install
npm link
```

That puts `cc-theme-check` on your `$PATH` globally. Or run without linking:

```bash
node /path/to/cc-theme-check/src/cli.mjs
```

## Usage

```
cc-theme-check                          auto-discover active theme
cc-theme-check path/to/my-theme.json    check a specific theme file
cc-theme-check --all                    show everything
```

### Flags

| Flag | What it shows |
|---|---|
| *(none)* | Header · mock conversation · 3-line contrast summary |
| `--audit` | Full WCAG breakdown with every failure listed |
| `--palette` | ANSI 16-color grid (requires `--ghostty`) |
| `--tokens` | All 69 tokens with colored swatches and contrast ratios |
| `--all` | Everything above |
| `--ghostty <path>` | Provide Ghostty theme for accurate canvas bg + ANSI palette |
| `--bg <#hex>` | Override canvas bg for contrast math |

### Examples

**Quickly verify your theme didn't break anything:**

```bash
cc-theme-check
```

**Hunt down a specific contrast failure:**

```bash
cc-theme-check --audit
```

**See every token rendered in context** (useful when you change a token and want to confirm where it shows up):

```bash
cc-theme-check --tokens
```

**Match what Claude Code actually renders inside your specific terminal:**

```bash
cc-theme-check --all --ghostty ~/.config/ghostty/themes/my-theme
```

`--ghostty` matters because Claude Code reads the terminal's ANSI palette for several surfaces (code highlighting, dim comments, etc.). Without it, the tool falls back to reasonable defaults but won't match what you see in your actual terminal.

## How it works

Under the hood, `cc-theme-check` uses **chalk** — the same color-rendering library Claude Code uses internally (in `src/colorize.ts`). The mock conversation goes through the same `process.env.TMUX && chalk.level > 2` clamping logic, so what you see is what Claude Code will render.

The WCAG contrast math uses sRGB linearization (the WCAG 2.x formula), not naive RGB averaging, so the ratios match what tools like axe DevTools and Stark report.

## Tested terminals

- Ghostty (truecolor outside tmux, 256-color inside)
- iTerm2
- macOS Terminal
- WezTerm

If chalk reports a different level than expected, the header makes it obvious — that's usually the bug.

## Known limitations

- The contrast audit treats every token as a foreground color. Background-only tokens (`diffAdded`, `diffRemoved`) are excluded from the audit but still rendered in the diff view.
- The mock conversation exercises ~22 of the 56 named tokens directly (tool calls, diff colors, status indicators, brief-mode labels, permission prompts, subagent dispatch, ultrathink rainbow). Use `--tokens` to see the rest.
- Auto-discovery reads `~/.claude/settings.json`. If you use a different config location, pass the theme path explicitly.

## License

MIT — see [LICENSE](LICENSE).

Built by [Cameron Sjo](https://github.com/cameronsjo) while tuning the [Artificer](https://github.com/cameronsjo/artificer-design-system) theme. Generic by design — Artificer is just the guinea pig.
