import { homedir } from 'node:os';
import { chalk, chalkLevelLabel } from '../colorize.mjs';
import { WIDTH } from './layout.mjs';

export function renderHeader(themeName, base, absPath, overrideCount, autodetect) {
  const homeStr = absPath.replace(homedir(), '~');
  const lines = [
    `  cc-theme-check · Claude Code Theme Verifier`,
    ``,
    `  Theme:   ${themeName ?? '(unnamed)'}`,
    `  Base:    ${base ?? '(none)'}`,
    `  File:    ${homeStr}`,
    `  Tokens:  ${overrideCount} override${overrideCount === 1 ? '' : 's'}`,
    `  Chalk:   ${chalkLevelLabel()}`,
  ];

  const term = autodetect?.terminal;
  if (term?.name || term?.isTmux) {
    const parts = [];
    if (term.name) parts.push(`Term: ${term.name}`);
    if (term.isTmux) parts.push('tmux: yes');
    lines.push(`  ${parts.join('  ·  ')}`);
  }
  const ghostty = autodetect?.ghostty;
  if (ghostty?.themeName) {
    lines.push(`  Ghostty: ${ghostty.themeName}${ghostty.path ? '' : ' (not found)'}`);
  }

  const innerWidth = WIDTH - 2;
  const border  = `  ┌${'─'.repeat(innerWidth)}┐`;
  const borderB = `  └${'─'.repeat(innerWidth)}┘`;

  process.stdout.write(`\n${chalk.bold(border)}\n`);
  for (const line of lines) {
    const padded = line + ' '.repeat(Math.max(0, innerWidth - line.length + 2));
    process.stdout.write(`${chalk.bold(padded.slice(0, 2))}${padded.slice(2, innerWidth + 2)}${chalk.bold('│')}\n`);
  }
  process.stdout.write(`${chalk.bold(borderB)}\n`);
}
