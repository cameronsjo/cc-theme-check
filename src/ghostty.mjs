import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { die } from './discover.mjs';
import { parseIniLine } from './ini.mjs';
import { debug } from './debug.mjs';

export function loadGhosttyTheme(ghosttyPath) {
  const absPath = resolve(ghosttyPath);
  debug('ghostty load start', { path: absPath });
  if (!existsSync(absPath)) {
    debug('ghostty file not found', { path: absPath });
    die(`Ghostty theme file not found: ${absPath}`);
  }
  try {
    const lines = readFileSync(absPath, 'utf8').split('\n');
    const result = { background: null, foreground: null, palette: {} };
    for (const line of lines) {
      const parsed = parseIniLine(line);
      if (!parsed) continue;
      const { key, value } = parsed;
      if (key === 'background') result.background = '#' + value.replace('#', '');
      else if (key === 'foreground') result.foreground = '#' + value.replace('#', '');
      else if (key === 'palette') {
        const [pos, hex] = value.split('=');
        if (pos !== undefined && hex !== undefined) result.palette[parseInt(pos, 10)] = '#' + hex.replace('#', '');
      }
    }
    debug('ghostty load ok', {
      path: absPath,
      hasBg: !!result.background,
      hasFg: !!result.foreground,
      paletteCount: Object.keys(result.palette).length,
    });
    return result;
  } catch (err) {
    debug('ghostty load failed', { path: absPath, error: err.message });
    throw err;
  }
}
