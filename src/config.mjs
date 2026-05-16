// Persistent user settings at ~/.config/cc-theme-check/config.json
// (or $XDG_CONFIG_HOME/cc-theme-check/config.json). Plain JSON, all keys
// optional. Missing file is a first-run path — loadConfig() returns {}.
//
// Schema (every key optional):
//   ghosttyTheme: string  — path or theme-name resolved against
//                            ~/.config/ghostty/themes/<name>
//   bgOverride:   string  — hex color, wins over autodetected bg
//   themePath:    string  — overrides discoverTheme() lookup
//   defaultFlags: { audit?, palette?, tokens?, all? }
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

function xdgConfigHome() {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

export function configPath() {
  return join(xdgConfigHome(), 'cc-theme-check', 'config.json');
}

export async function loadConfig() {
  try {
    return JSON.parse(await readFile(configPath(), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function saveConfig(next) {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
}
