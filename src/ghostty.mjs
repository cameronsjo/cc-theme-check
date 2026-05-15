import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { die } from './discover.mjs';

export function loadGhosttyTheme(ghosttyPath) {
  const absPath = resolve(ghosttyPath);
  if (!existsSync(absPath)) die(`Ghostty theme file not found: ${absPath}`);
  const lines = readFileSync(absPath, 'utf8').split('\n');
  const result = { background: null, foreground: null, palette: {} };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf(' = ');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 3).trim();
    if (key === 'background') result.background = '#' + val.replace('#', '');
    else if (key === 'foreground') result.foreground = '#' + val.replace('#', '');
    else if (key === 'palette') {
      const [pos, hex] = val.split('=');
      if (pos !== undefined && hex !== undefined) result.palette[parseInt(pos, 10)] = '#' + hex.replace('#', '');
    }
  }
  return result;
}
