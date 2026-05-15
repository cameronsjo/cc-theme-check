#!/usr/bin/env node
import { resolve } from 'node:path';
import { chalk } from './colorize.mjs';
import { discoverTheme } from './discover.mjs';
import { runOnce } from './render-all.mjs';

function showHelp() {
  process.stdout.write(`
${chalk.bold('cc-theme-check')} · Claude Code Theme Verifier

${chalk.bold('Usage')}
  cc-theme-check                                 auto-discover active theme
  cc-theme-check path/to/my-theme.json          check a specific theme file
  cc-theme-check --watch                         live reload on theme-file save
  cc-theme-check --all                           show everything

${chalk.bold('Flags')}
  --audit        Show full WCAG contrast breakdown
  --palette      Show ANSI 16-color palette (requires --ghostty)
  --tokens       Show all 69 token swatches with contrast ratios
  --all          Show everything
  --watch        Re-render on theme-file change (Ctrl-C to exit)
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
  const opts = {
    ghosttyPath: null, bgOverride: null, themePath: null,
    audit: false, palette: false, tokens: false, watch: false,
  };
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
    else if (a === '--watch') opts.watch = true;
    else if (!a.startsWith('--')) opts.themePath = a;
    i++;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  const themePath = opts.themePath ? resolve(opts.themePath) : discoverTheme().themePath;

  if (opts.watch) {
    const { watchAndRender } = await import('./watch.mjs');
    await watchAndRender(themePath, opts);
    return;
  }

  runOnce(themePath, opts);
}

main().catch((err) => { console.error(err); process.exit(1); });
