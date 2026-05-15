import { chalk } from '../colorize.mjs';

export const WIDTH = 72;

export function pad(str, len, char = ' ') {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = len - stripped.length;
  return diff > 0 ? str + char.repeat(diff) : str;
}

export function rule(char = '─', label = '') {
  if (label) {
    const line = `  ${char.repeat(3)} ${label} `;
    const rest = WIDTH - line.replace(/\x1b\[[0-9;]*m/g, '').length;
    return chalk.dim(`${line}${char.repeat(Math.max(0, rest))}`);
  }
  return chalk.dim(`  ${char.repeat(WIDTH - 2)}`);
}

export function sectionHeader(num, title) {
  const label = typeof num === 'string' ? `${num} — ${title}` : `${num.toString().padStart(2, '0')} — ${title}`;
  process.stdout.write(`\n${rule('─', label)}\n\n`);
}

// Platform-dependent glyphs used by the mock conversation.
// Mirrors Claude Code's BLACK_CIRCLE swap in src/constants/figures.ts.
export function glyphs() {
  const darwin = process.platform === 'darwin';
  return {
    toolDot:     darwin ? '⏺' : '●',  // tool-use prefix
    connector:   '⎿',                 // tool-result connector (U+23BB)
    thinkingDot: '◆',                 // thinking indicator
    youPrompt:   '❯',                 // user prompt arrow
    queuedDot:   '○',                 // queued/inactive tool
  };
}
