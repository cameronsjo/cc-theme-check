import { chalk, cfg, cbg } from '../colorize.mjs';
import { auditContrast, wcagBadge } from '../contrast.mjs';
import { sectionHeader, pad, rule } from './layout.mjs';

const ANSI_NAMES = [
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'bright black', 'bright red', 'bright green', 'bright yellow',
  'bright blue', 'bright magenta', 'bright cyan', 'bright white',
];

export function renderPalette(ghosttyTheme, canvasBg) {
  sectionHeader('00', 'ANSI Palette (Ghostty)');
  const { palette, foreground } = ghosttyTheme;

  for (let row = 0; row < 2; row++) {
    let line = '  ';
    for (let col = 0; col < 8; col++) {
      const hex = palette[row * 8 + col];
      line += hex ? `${cbg(hex, '  ')} ` : `${chalk.dim('░░')} `;
    }
    line += '  ';
    for (let col = 0; col < 8; col++) line += `${chalk.dim(String(row * 8 + col).padStart(2))} `;
    process.stdout.write(line + '\n');
  }
  process.stdout.write('\n');

  for (let i = 0; i < 16; i++) {
    const hex = palette[i];
    const name = ANSI_NAMES[i] ?? `palette-${i}`;
    if (!hex) continue;
    const ratio = auditContrast(`ansi-${i} (${name})`, hex, canvasBg);
    const badge = ratio !== null ? wcagBadge(ratio) : '';
    process.stdout.write(`  ${cbg(hex, '  ')} ${pad(`${chalk.dim(String(i).padStart(2))}  ${cfg(hex, name)}`, 30)}  ${chalk.dim(hex)}  ${badge}\n`);
  }

  process.stdout.write('\n');
  process.stdout.write(rule('·', 'mock terminal content'));
  process.stdout.write('\n\n');

  const fgHex = foreground ?? palette[7] ?? '#cccccc';
  const code12 = palette[12] ?? palette[4] ?? '#6699cc';
  const dim8 = palette[8] ?? '#666666';
  const err1 = palette[1] ?? '#cc4444';
  const ok2 = palette[2] ?? '#44aa66';

  process.stdout.write(`  ${cfg(fgHex, 'Response body text rendered in terminal foreground.')}\n`);
  process.stdout.write(`  ${cfg(fgHex, 'Use ')}${cfg(code12, '`inline code`')}${cfg(fgHex, ' (position 12 — bright blue)')}\n`);
  process.stdout.write(`  ${cfg(dim8, '# Comments and dim secondary text (position 8)')}\n`);
  process.stdout.write(`  ${cfg(err1, '✗ Error: build failed — connection refused')}\n`);
  process.stdout.write(`  ${cfg(ok2, '✓ Tests passed (42 specs, 0 failures)')}\n`);
}
