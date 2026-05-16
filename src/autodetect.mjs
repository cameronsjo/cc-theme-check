// Read-side autodetection — Ghostty config + terminal env. All functions
// return either a result object or null; never throw. The caller decides
// what to do with absent data (the launcher dims those header lines; the
// option resolver picks the next fallback in the precedence chain).
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function ghosttyConfigPath() {
  return join(homedir(), '.config', 'ghostty', 'config');
}

function ghosttyThemesDir() {
  return join(homedir(), '.config', 'ghostty', 'themes');
}

// Parse ~/.config/ghostty/config and find:
//   theme = <name>            → resolve against ~/.config/ghostty/themes/<name>
//   theme = /abs/path         → use directly
// Returns { themeName, path, configPath } or null if config absent / no theme line.
export function detectGhosttyTheme() {
  const configPath = ghosttyConfigPath();
  if (!existsSync(configPath)) return null;
  let lines;
  try {
    lines = readFileSync(configPath, 'utf8').split('\n');
  } catch {
    return null;
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key !== 'theme' || !val) continue;
    const path = val.startsWith('/') ? val : join(ghosttyThemesDir(), val);
    if (!existsSync(path)) return { themeName: val, path: null, configPath };
    return { themeName: val, path, configPath };
  }
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
