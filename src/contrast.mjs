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

export function wcagBadge(ratio) {
  const r = parseFloat(ratio.toFixed(1));
  if (r >= 4.5) return chalk.hex('#4fae50')(`${r.toFixed(1)}:1 AA`);
  if (r >= 3.0) return chalk.hex('#c4932a')(`${r.toFixed(1)}:1 aa`);
  return chalk.hex('#b85a55')(`${r.toFixed(1)}:1 FAIL`);
}

export function tok(overrides, key, fallback) {
  const v = overrides?.[key];
  return isValidHex(v) ? v : (fallback ?? null);
}
