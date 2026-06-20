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
import { loadConfig } from './config.mjs';
import { detectGhosttyTheme, detectTerminal, resolveGhosttyThemeName } from './autodetect.mjs';
import { debug } from './debug.mjs';

export async function resolveOptions(rawCli) {
  debug('resolveOptions start', {});
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
    resolveGhosttyThemeName(settings.ghosttyTheme),
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

  const result = {
    ...rawCli,
    ghosttyPath, bgOverride, themePath,
    audit:   flagOn('audit'),
    palette: flagOn('palette'),
    tokens:  flagOn('tokens'),
    autodetect: { ghostty, terminal },
    sources,
  };

  debug('resolveOptions ok', {
    ghosttyPathSource: sources.ghosttyPath,
    bgOverrideSource: sources.bgOverride,
    themePathSource: sources.themePath,
    audit: result.audit,
    palette: result.palette,
    tokens: result.tokens,
  });

  return result;
}
