#!/usr/bin/env node
import { resolve } from 'node:path';
import { chalk } from './colorize.mjs';
import { discoverTheme, loadTheme, die } from './discover.mjs';
import { loadGhosttyTheme } from './ghostty.mjs';
import { renderHeader } from './render/header.mjs';
import { renderConversation } from './render/conversation.mjs';
import { renderPalette } from './render/palette.mjs';
import { renderAllTokens } from './render/tokens.mjs';
import { renderContrastSummary, renderAudit, renderFooter } from './render/audit.mjs';

function showHelp() {
  process.stdout.write(`
${chalk.bold('cc-theme-check')} · Claude Code Theme Verifier

${chalk.bold('Usage')}
  cc-theme-check                                 auto-discover active theme
  cc-theme-check path/to/my-theme.json          check a specific theme file
  cc-theme-check --all                           show everything

${chalk.bold('Flags')}
  --audit        Show full WCAG contrast breakdown
  --palette      Show ANSI 16-color palette (requires --ghostty)
  --tokens       Show all 69 token swatches with contrast ratios
  --all          Show everything
  --ghostty <p>  Provide Ghostty theme for ANSI palette + canvas bg
  --bg <#hex>    Override terminal background for contrast math
  --help         Show this message

${chalk.bold('Default output')}
  Header + mock conversation + 3-line contrast summary.
  Add flags for more detail.

`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { ghosttyPath: null, bgOverride: null, themePath: null, audit: false, palette: false, tokens: false };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--help' || a === '-h') { showHelp(); process.exit(0); }
    else if (a === '--ghostty') opts.ghosttyPath = args[++i] ?? null;
    else if (a === '--bg') opts.bgOverride = args[++i] ?? null;
    else if (a === '--audit') opts.audit = true;
    else if (a === '--palette') opts.palette = true;
    else if (a === '--tokens') opts.tokens = true;
    else if (a === '--all') { opts.audit = true; opts.palette = true; opts.tokens = true; }
    else if (!a.startsWith('--')) opts.themePath = a;
    i++;
  }
  return opts;
}

function resolveCanvasBg(opts, raw, ghosttyTheme) {
  if (opts.bgOverride) return opts.bgOverride;
  if (ghosttyTheme?.background) return ghosttyTheme.background;
  const base = raw.base ?? '';
  if (base.includes('dark')) return '#1a1b26';
  if (base.includes('light')) return '#f5f5f5';
  return '#1a1b26';
}

function main() {
  const opts = parseArgs(process.argv);

  let themePath;
  if (opts.themePath) {
    themePath = resolve(opts.themePath);
  } else {
    const discovered = discoverTheme();
    themePath = discovered.themePath;
  }

  const { raw, absPath } = loadTheme(themePath);
  const overrides = raw.overrides ?? {};
  const overrideCount = Object.keys(overrides).length;

  let ghosttyTheme = null;
  if (opts.ghosttyPath) ghosttyTheme = loadGhosttyTheme(opts.ghosttyPath);

  const canvasBg = resolveCanvasBg(opts, raw, ghosttyTheme);

  // ── Always shown ────────────────────────────────────────────────
  renderHeader(raw.name, raw.base, absPath, overrideCount);
  renderConversation(overrides, canvasBg, ghosttyTheme);
  renderContrastSummary();

  // ── Behind flags ────────────────────────────────────────────────
  if (opts.palette && ghosttyTheme) renderPalette(ghosttyTheme, canvasBg);
  if (opts.tokens) renderAllTokens(overrides, canvasBg);
  if (opts.audit) renderAudit(canvasBg);

  renderFooter(raw.name);
}

main();
