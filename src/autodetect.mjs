// Read-side autodetection — Ghostty config + terminal env. All functions
// return either a result object or null; never throw. The caller decides
// what to do with absent data (the launcher dims those header lines; the
// option resolver picks the next fallback in the precedence chain).
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { parseIniLine } from './ini.mjs';
import { debug } from './debug.mjs';

function ghosttyConfigPath() {
  return join(homedir(), '.config', 'ghostty', 'config');
}

function ghosttyThemesDir() {
  return join(homedir(), '.config', 'ghostty', 'themes');
}

// Resolve a Ghostty theme reference (absolute path OR theme name in the
// user's themes dir) to an absolute file path, or null if it can't be
// found. Exported so settings-driven resolution in options.mjs doesn't
// re-implement the path math.
export function resolveGhosttyThemeName(value) {
  if (!value) return null;
  // Absolute path: pass through unconditionally — the user is being
  // explicit, and downstream loadGhosttyTheme() will surface a clear
  // error if the file is missing. Name-in-themes-dir validates because
  // a typo should fall through to autodetect, not crash later.
  // isAbsolute() handles both POSIX (/foo) and Windows (C:\foo).
  if (isAbsolute(value)) return value;
  const path = join(ghosttyThemesDir(), value);
  return existsSync(path) ? path : null;
}

export function detectGhosttyTheme() {
  const configPath = ghosttyConfigPath();
  debug('autodetect ghostty start', { configPath });
  let lines;
  try {
    lines = readFileSync(configPath, 'utf8').split('\n');
  } catch (err) {
    if (err.code === 'ENOENT') {
      debug('ghostty config not found', { configPath });
      return null;
    }
    debug('ghostty config read failed', { configPath, error: err.message });
    return null;
  }
  for (const line of lines) {
    const parsed = parseIniLine(line);
    if (!parsed || parsed.key !== 'theme' || !parsed.value) continue;
    const path = resolveGhosttyThemeName(parsed.value);
    debug('autodetect ghostty ok', { themeName: parsed.value, hasPath: !!path });
    return { themeName: parsed.value, path, configPath };
  }
  debug('autodetect ghostty no theme found', { configPath });
  return null;
}

// Sniff terminal + tmux from env. $TERM_PROGRAM names get normalized for
// the header line ('Apple_Terminal' → 'Terminal.app').
export function detectTerminal() {
  const raw = process.env.TERM_PROGRAM || '';
  const name = (
    raw === 'Apple_Terminal' ? 'Terminal.app' :
    raw === 'iTerm.app'      ? 'iTerm2' :
    raw === 'ghostty'        ? 'Ghostty' :
    raw === 'WezTerm'        ? 'WezTerm' :
    raw || null
  );
  const isTmux = Boolean(process.env.TMUX);
  return { name, isTmux };
}
