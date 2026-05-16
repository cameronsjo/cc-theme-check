// Resolve the final option bag the rest of the tool consumes by walking
// the precedence chain for each user-tweakable value:
//
//   CLI flag    >  settings file    >  autodetect    >  default
//
// The returned object is a drop-in superset of the raw CLI opts (preserves
// watch/edit/init/initSlug as-is) plus:
//   - autodetect: { ghostty, terminal }  for the header to surface
//   - sources:    { field: 'flag'|'settings'|'autodetect'|'default' }
//                 for the Settings UI to label which override wins
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './config.mjs';
import { detectGhosttyTheme, detectTerminal } from './autodetect.mjs';

export async function resolveOptions(rawCli) {
  const settings = await loadConfig();
  const ghostty = detectGhosttyTheme();
  const terminal = detectTerminal();

  const sources = {};
  const pick = (field, flag, fromSettings, fromDetect) => {
    if (flag != null)         { sources[field] = 'flag';       return flag; }
    if (fromSettings != null) { sources[field] = 'settings';   return fromSettings; }
    if (fromDetect != null)   { sources[field] = 'autodetect'; return fromDetect; }
    sources[field] = 'default';
    return null;
  };

  const ghosttyPath = pick('ghosttyPath',
    rawCli.ghosttyPath,
    resolveGhosttyFromSettings(settings.ghosttyTheme),
    ghostty?.path,
  );
  const bgOverride = pick('bgOverride', rawCli.bgOverride, settings.bgOverride, null);
  const themePath  = pick('themePath',  rawCli.themePath,  settings.themePath,  null);

  const flagOn = (field) => {
    const direct = rawCli[field];
    if (direct === true) { sources[field] = 'flag'; return true; }
    const defaults = settings.defaultFlags ?? {};
    if (defaults.all || defaults[field]) { sources[field] = 'settings'; return true; }
    sources[field] = 'default';
    return false;
  };

  return {
    ...rawCli,
    ghosttyPath, bgOverride, themePath,
    audit:   flagOn('audit'),
    palette: flagOn('palette'),
    tokens:  flagOn('tokens'),
    autodetect: { ghostty, terminal },
    sources,
  };
}

// settings.ghosttyTheme is either an absolute path or a theme-name to
// resolve against ~/.config/ghostty/themes/. Returns null if the file
// can't be found — caller falls back to autodetect or default.
function resolveGhosttyFromSettings(value) {
  if (!value) return null;
  if (value.startsWith('/')) return value;
  const path = join(homedir(), '.config', 'ghostty', 'themes', value);
  return existsSync(path) ? path : null;
}
