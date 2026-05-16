#!/usr/bin/env node
import { resolve } from 'node:path';
import { chalk } from './colorize.mjs';
import { debug } from './debug.mjs';
import { discoverTheme } from './discover.mjs';
import { resolveOptions } from './options.mjs';
import { runOnce } from './render-all.mjs';

function showHelp() {
  process.stdout.write(`
${chalk.bold('cc-theme-check')} · Claude Code Theme Verifier

${chalk.bold('Usage')}
  cc-theme-check                                 launcher TUI (or verify, if piped)
  cc-theme-check path/to/my-theme.json          check a specific theme file
  cc-theme-check --verify                        one-shot verify (skip launcher)
  cc-theme-check --menu                          force launcher (even if piped)
  cc-theme-check --watch                         live reload on theme-file save
  cc-theme-check --edit                          interactive TUI forge
  cc-theme-check --init [slug]                   scaffold a new theme
  cc-theme-check --all                           show everything

${chalk.bold('Flags')}
  --verify        One-shot verify (overrides TTY-launcher default)
  --menu          Open launcher TUI explicitly (even when piped)
  --audit         Show full WCAG contrast breakdown
  --palette       Show ANSI 16-color palette
  --tokens        Show all 69 token swatches with contrast ratios
  --all           Show everything
  --watch         Re-render on theme-file change (Ctrl-C to exit)
  --edit          Open the Ink-based TUI forge
  --init [slug]   Scaffold a new theme JSON from a template
  --ghostty <p>   Provide Ghostty theme for ANSI palette + canvas bg
                  (optional — auto-detected from ~/.config/ghostty/config)
  --bg <#hex>     Override terminal background for contrast math
  --help          Show this message

${chalk.bold('Default output')}
  Header + mock conversation + 3-line contrast summary.
  Add flags for more detail.

`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    ghosttyPath: null, bgOverride: null, themePath: null,
    audit: false, palette: false, tokens: false, watch: false, edit: false,
    init: false, initSlug: null, verify: false, menu: false,
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
    else if (a === '--edit') opts.edit = true;
    else if (a === '--verify') opts.verify = true;
    else if (a === '--menu') opts.menu = true;
    else if (a === '--init') {
      opts.init = true;
      // Optional positional slug right after --init
      if (args[i + 1] && !args[i + 1].startsWith('--')) opts.initSlug = args[++i];
    }
    else if (!a.startsWith('--')) opts.themePath = a;
    i++;
  }
  return opts;
}

// The bare `cc-theme-check` command opens the launcher when stdin/stdout
// are both TTY and the user didn't pass any explicit mode flag or theme
// arg — keeping the tool scriptable. `--menu` forces the launcher even
// when piped; `--verify` forces one-shot even in a TTY.
function shouldOpenMenu(raw) {
  if (raw.menu) return true;
  if (raw.verify) return false;
  if (raw.watch || raw.edit || raw.init) return false;
  if (raw.themePath) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function main() {
  debug('cli start', {});
  const raw = parseArgs(process.argv);

  if (raw.init) {
    debug('init mode requested', { initSlug: raw.initSlug ?? 'none' });
    const { runInit } = await import('./init.mjs');
    await runInit(raw.initSlug);
    return;
  }

  const opts = await resolveOptions(raw);

  if (shouldOpenMenu(raw)) {
    debug('menu mode (TTY)', {});
    const { launchMenu } = await import('./menu/index.mjs');
    const choice = await launchMenu({ resolved: opts });
    debug('menu dispatched', { action: choice.action });
    if (choice.action === 'quit') return;
    // Map menu choice → mode flag and fall through.
    if (choice.action === 'verify') opts.verify = true;
    else if (choice.action === 'watch') opts.watch = true;
    else if (choice.action === 'forge') opts.edit = true;
    else if (choice.action === 'init') {
      const { runInit } = await import('./init.mjs');
      await runInit();
      return;
    }
  }

  const themePath = opts.themePath ? resolve(opts.themePath) : discoverTheme().themePath;
  debug('theme path resolved', { themePath, source: opts.themePath ? 'explicit' : 'discovered' });

  if (opts.edit) {
    debug('edit mode requested', { themePath });
    const { launchForge } = await import('./forge/index.mjs');
    await launchForge({ themePath, opts });
    return;
  }

  if (opts.watch) {
    debug('watch mode requested', { themePath });
    const { watchAndRender } = await import('./watch.mjs');
    await watchAndRender(themePath, opts);
    return;
  }

  debug('verify mode', { themePath });
  runOnce(themePath, opts);
}

main().catch((err) => {
  debug('cli error', { error: err.message });
  console.error(err);
  process.exit(1);
});
