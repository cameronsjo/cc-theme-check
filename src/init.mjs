// --init: scaffold a new theme JSON from a template (or the active theme),
// optionally rewire settings.json to use it. Plain stdin prompts — no Ink.
// Handles both interactive TTY use and piped input (for scripts / tests).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chalk } from './colorize.mjs';
import { discoverTheme, loadTheme } from './discover.mjs';

const THEMES_DIR   = join(homedir(), '.claude', 'themes');
const SETTINGS     = join(homedir(), '.claude', 'settings.json');
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'templates');

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

// readline/promises has a long-standing quirk where rl.question() leaves
// the stream paused, so the second call hangs on piped input. We sidestep
// it: for TTY use the readline API normally; for non-TTY drain stdin
// upfront and dispense lines in order.
function makePrompter() {
  if (process.stdin.isTTY) {
    // Lazy-load readline so non-TTY paths don't pull it in.
    return import('node:readline/promises').then(({ createInterface }) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      return {
        ask: async (q) => (await rl.question(q)).trim(),
        close: () => rl.close(),
      };
    });
  }
  // Non-TTY: pre-read all of stdin, then dispense.
  return drainStdin().then((lines) => ({
    ask: async (q) => {
      process.stdout.write(q);
      const next = lines.shift() ?? '';
      process.stdout.write(next + '\n');
      return next.trim();
    },
    close: () => {},
  }));
}

async function drainStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString().replace(/\n$/, '').split('\n');
}

export async function runInit(slugArg) {
  const prompter = await makePrompter();
  try {
    const slug = await pickSlug(prompter, slugArg);
    if (!slug) return;

    const base = await pickBase(prompter);
    const source = await pickTemplate(prompter);

    const overrides = source === 'from-active'
      ? await readActiveOverrides()
      : await loadTemplateOverrides(base);

    const themeJson = {
      name: titleCase(slug),
      base: `${base}-ansi`,
      overrides,
    };

    const outPath = join(THEMES_DIR, `${slug}.json`);
    if (existsSync(outPath)) {
      const confirm = await prompter.ask(chalk.yellow(`${outPath} exists. Overwrite? [y/N]: `));
      if (confirm.toLowerCase() !== 'y') {
        process.stdout.write('Aborted.\n');
        return;
      }
    }

    await mkdir(THEMES_DIR, { recursive: true });
    await writeFile(outPath, JSON.stringify(themeJson, null, 2) + '\n', 'utf8');
    process.stdout.write(`${chalk.green('✓')} wrote ${outPath}\n`);

    await maybeUpdateSettings(prompter, slug);

    process.stdout.write(chalk.dim(`\nNext:  cc-theme-check --edit ${outPath}\n`));
    process.stdout.write(chalk.dim(`  or:  cc-theme-check --watch ${outPath}\n`));
  } finally {
    prompter.close();
  }
}

async function pickSlug(prompter, slugArg) {
  let slug = slugArg;
  if (!slug) {
    slug = await prompter.ask('Theme slug (kebab-case, e.g. ocean-dark): ');
  }
  if (!SLUG_RE.test(slug)) {
    process.stderr.write(chalk.red(`Invalid slug: "${slug}". Use kebab-case (lowercase a-z, 0-9, -).\n`));
    return null;
  }
  return slug;
}

async function pickBase(prompter) {
  const ans = (await prompter.ask('Base [dark/light] (dark): ')).toLowerCase();
  return ans === 'light' ? 'light' : 'dark';
}

async function pickTemplate(prompter) {
  const ans = (await prompter.ask('Template [minimal/from-active] (minimal): ')).toLowerCase();
  return ans === 'from-active' ? 'from-active' : 'minimal';
}

async function loadTemplateOverrides(base) {
  const file = join(TEMPLATE_DIR, `${base}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  return json.overrides ?? {};
}

async function readActiveOverrides() {
  try {
    const { themePath } = discoverTheme();
    const { raw } = loadTheme(themePath);
    return raw.overrides ?? {};
  } catch (err) {
    process.stderr.write(chalk.yellow(`Couldn't read active theme (${err.message}); falling back to dark template.\n`));
    return loadTemplateOverrides('dark');
  }
}

async function maybeUpdateSettings(prompter, slug) {
  const ans = (await prompter.ask(`Update ~/.claude/settings.json to use custom:${slug}? [y/N]: `)).toLowerCase();
  if (ans !== 'y') return;

  try {
    const settings = JSON.parse(await readFile(SETTINGS, 'utf8'));
    const prev = settings.theme;
    settings.theme = `custom:${slug}`;
    await writeFile(SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    process.stdout.write(`${chalk.green('✓')} settings.json theme: custom:${slug}  ${chalk.dim(`(was: ${prev ?? 'unset'})`)}\n`);
  } catch (err) {
    process.stderr.write(chalk.red(`Couldn't update settings: ${err.message}\n`));
  }
}

function titleCase(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
