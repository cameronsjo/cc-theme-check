import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { chalk } from './colorize.mjs';

export function die(msg) {
  process.stderr.write(`\n  ${chalk.hex('#b85a55')('Error:')} ${msg}\n\n`);
  process.exit(1);
}

export function discoverTheme() {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  if (!existsSync(settingsPath)) die(`Settings file not found: ${settingsPath}`);
  let settings;
  try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch (e) { die(`Failed to parse ${settingsPath}: ${e.message}`); }
  const themeName = settings.theme;
  if (!themeName) die('No "theme" key found in ~/.claude/settings.json.');
  if (themeName.startsWith('custom:')) {
    const slug = themeName.slice(7);
    const themePath = join(homedir(), '.claude', 'themes', `${slug}.json`);
    if (!existsSync(themePath)) die(`Custom theme file not found: ${themePath}`);
    return { themePath, displayPath: themePath };
  }
  process.stdout.write(`\n  ${chalk.bold('Active theme:')} ${themeName} (built-in preset)\n`);
  process.stdout.write(`  Built-in presets can't be previewed. Pass a custom theme file instead:\n`);
  process.stdout.write(`  ${chalk.dim('cc-theme-check path/to/my-theme.json')}\n\n`);
  process.exit(0);
}

export function loadTheme(themePath) {
  const absPath = resolve(themePath);
  if (!existsSync(absPath)) die(`Theme file not found: ${absPath}`);
  let raw;
  try { raw = JSON.parse(readFileSync(absPath, 'utf8')); } catch (e) { die(`Failed to parse: ${e.message}`); }
  return { raw, absPath };
}
