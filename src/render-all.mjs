// Single-pass render of every section in the order cli.mjs uses.
// Exported so watch.mjs and forge/ can call the same render without
// duplicating the orchestration logic.
import { debug } from './debug.mjs';
import { loadTheme } from './discover.mjs';
import { loadGhosttyTheme } from './ghostty.mjs';
import { resetAudit } from './contrast.mjs';
import { renderHeader } from './render/header.mjs';
import { renderConversation } from './render/conversation.mjs';
import { renderPalette } from './render/palette.mjs';
import { renderAllTokens } from './render/tokens.mjs';
import { renderContrastSummary, renderAudit, renderFooter } from './render/audit.mjs';

export function resolveCanvasBg(opts, raw, ghosttyTheme) {
  if (opts.bgOverride) return opts.bgOverride;
  if (ghosttyTheme?.background) return ghosttyTheme.background;
  const base = raw.base ?? '';
  if (base.includes('dark')) return '#1a1b26';
  if (base.includes('light')) return '#f5f5f5';
  return '#1a1b26';
}

export function runOnce(themePath, opts) {
  debug('runOnce start', { themePath });
  resetAudit();

  const { raw, absPath } = loadTheme(themePath);
  const overrides = raw.overrides ?? {};
  const overrideCount = Object.keys(overrides).length;

  const ghosttyTheme = opts.ghosttyPath ? loadGhosttyTheme(opts.ghosttyPath) : null;
  const canvasBg = resolveCanvasBg(opts, raw, ghosttyTheme);

  debug('render orchestration', {
    themeName: raw.name,
    base: raw.base,
    overrideCount,
    hasGhosttyTheme: !!ghosttyTheme,
    canvasBg,
    audit: opts.audit,
    palette: opts.palette,
    tokens: opts.tokens,
  });

  renderHeader(raw.name, raw.base, absPath, overrideCount, opts.autodetect);
  renderConversation(overrides, canvasBg, ghosttyTheme);
  renderContrastSummary();

  if (opts.palette && ghosttyTheme) renderPalette(ghosttyTheme, canvasBg);
  if (opts.tokens) renderAllTokens(overrides, canvasBg);
  if (opts.audit) renderAudit(canvasBg);

  renderFooter(raw.name);
  debug('runOnce ok', { themeName: raw.name });
}
