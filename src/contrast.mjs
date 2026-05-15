import { chalk } from './colorize.mjs';

function hexToRgb(hex) {
  hex = hex.replace('#', '').replace(/^(\w)(\w)(\w)$/, '$1$1$2$2$3$3');
  return [parseInt(hex.slice(0,2),16)/255, parseInt(hex.slice(2,4),16)/255, parseInt(hex.slice(4,6),16)/255];
}

function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg, bg) {
  const l1 = luminance(fg), l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function isValidHex(s) {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

export const auditLog = [];
const auditedKeys = new Set();

export function auditContrast(label, hex, canvasBg) {
  if (!isValidHex(hex) || !isValidHex(canvasBg)) return null;
  const ratio = contrastRatio(hex, canvasBg);
  if (!auditedKeys.has(label)) {
    auditedKeys.add(label);
    auditLog.push({ label, hex, ratio, canvasBg });
  }
  return ratio;
}

// Watch/edit modes call this between renders so the audit reflects
// the current theme state, not an accumulation across reloads.
export function resetAudit() {
  auditLog.length = 0;
  auditedKeys.clear();
}

// Shared source of truth for WCAG badge classification. Both the chalk
// renderer (wcagBadge below) and the Ink EditRow consume this — keeps
// thresholds and labels from drifting when issue #1 (role-aware audit)
// lands and introduces additional buckets.
export function wcagBucket(ratio) {
  const r = parseFloat(ratio.toFixed(1));
  if (r >= 4.5) return { ratio: r, label: 'AA',   color: '#4fae50' };
  if (r >= 3.0) return { ratio: r, label: 'aa',   color: '#c4932a' };
  return            { ratio: r, label: 'FAIL', color: '#b85a55' };
}

export function wcagBadge(ratio) {
  const { ratio: r, label, color } = wcagBucket(ratio);
  return chalk.hex(color)(`${r.toFixed(1)}:1 ${label}`);
}

export function tok(overrides, key, fallback) {
  const v = overrides?.[key];
  return isValidHex(v) ? v : (fallback ?? null);
}
