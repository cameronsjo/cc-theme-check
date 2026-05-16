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
import { debug } from './debug.mjs';

function xdgConfigHome() {
  return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
}

export function configPath() {
  return join(xdgConfigHome(), 'cc-theme-check', 'config.json');
}

export async function loadConfig() {
  const path = configPath();
  debug('config load start', { path });
  try {
    const cfg = JSON.parse(await readFile(path, 'utf8'));
    debug('config load ok', { path, keys: Object.keys(cfg).length });
    return cfg;
  } catch (err) {
    if (err.code === 'ENOENT') {
      debug('config not found, first run', { path });
      return {};
    }
    debug('config load failed', { path, error: err.message });
    throw err;
  }
}

export async function saveConfig(next) {
  const path = configPath();
  debug('config save start', { path, keys: Object.keys(next).length });
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
    debug('config save ok', { path });
  } catch (err) {
    debug('config save failed', { path, error: err.message });
    throw err;
  }
}
