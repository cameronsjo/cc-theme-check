import { chalk } from '../colorize.mjs';
import { auditLog } from '../contrast.mjs';
import { sectionHeader, pad, rule, WIDTH } from './layout.mjs';

export function renderContrastSummary() {
  const passes = auditLog.filter(e => e.ratio >= 4.5);
  const aa = auditLog.filter(e => e.ratio >= 3.0 && e.ratio < 4.5);
  const fails = auditLog.filter(e => e.ratio < 3.0);

  process.stdout.write('\n');
  process.stdout.write(`  ${chalk.hex('#4fae50')(`${passes.length} AA`)}  `);
  process.stdout.write(`${chalk.hex('#c4932a')(`${aa.length} aa`)}  `);
  if (fails.length > 0) {
    process.stdout.write(`${chalk.hex('#b85a55')(`${fails.length} FAIL`)}  ${chalk.dim('run --audit for details')}`);
  } else {
    process.stdout.write(`${chalk.dim('0 FAIL')}`);
  }
  process.stdout.write('\n');
}

export function renderAudit(canvasBg) {
  sectionHeader('09', 'WCAG AA Contrast Audit');

  const passes = auditLog.filter(e => e.ratio >= 4.5);
  const aa = auditLog.filter(e => e.ratio >= 3.0 && e.ratio < 4.5);
  const fails = auditLog.filter(e => e.ratio < 3.0);
  const lineW = WIDTH - 4;

  process.stdout.write(`  ${chalk.dim('─'.repeat(lineW))}\n`);
  process.stdout.write(`  ${chalk.hex('#4fae50')('AA pass (≥4.5:1)')}${pad('', 4)}${chalk.bold(String(passes.length).padStart(3) + ' tokens')}\n`);
  process.stdout.write(`  ${chalk.hex('#c4932a')('aa pass (≥3.0:1)')}${pad('', 4)}${chalk.bold(String(aa.length).padStart(3) + ' tokens')}  ${chalk.dim('large text only')}\n`);
  const failLabel = fails.length > 0
    ? chalk.hex('#b85a55')('FAIL (<3.0:1)') + pad('', 7)
    : chalk.dim('FAIL (<3.0:1)') + pad('', 7);
  process.stdout.write(`  ${failLabel}${chalk.bold(String(fails.length).padStart(3) + ' tokens')}${fails.length > 0 ? `  ${chalk.hex('#b85a55')('← investigate')}` : ''}\n`);
  process.stdout.write(`  ${chalk.dim('─'.repeat(lineW))}\n`);

  if (fails.length > 0) {
    process.stdout.write(`\n  ${chalk.bold('Failures:')}\n`);
    for (const { label, hex, ratio, canvasBg: c } of fails) {
      process.stdout.write(`    ${chalk.hex('#b85a55')(pad(label, 28))}  ${chalk.dim(hex)}  ${chalk.hex('#b85a55')(ratio.toFixed(1) + ':1')}  ${chalk.dim('on ' + c)}\n`);
    }
  }
  if (aa.length > 0) {
    process.stdout.write(`\n  ${chalk.bold('Large-text only (aa):')}\n`);
    for (const { label, hex, ratio } of aa) {
      process.stdout.write(`    ${chalk.hex('#c4932a')(pad(label, 28))}  ${chalk.dim(hex)}  ${chalk.hex('#c4932a')(ratio.toFixed(1) + ':1')}\n`);
    }
  }
}

export function renderFooter(themeName) {
  process.stdout.write('\n');
  process.stdout.write(rule());
  process.stdout.write(`\n  ${chalk.dim(`cc-theme-check · ${themeName ?? 'theme'} · ${new Date().toLocaleDateString('en-CA')}`)}\n\n`);
}
