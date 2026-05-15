import { chalk, cfg, cbg } from '../colorize.mjs';
import { tok, auditContrast } from '../contrast.mjs';
import { sectionHeader, WIDTH } from './layout.mjs';

export function renderConversation(overrides, canvasBg, ghosttyTheme) {
  sectionHeader('✦', 'Mock Conversation');

  const t = (key, fallback) => {
    const hex = tok(overrides, key, fallback);
    if (hex) auditContrast(key, hex, canvasBg);
    return hex;
  };
  // For tokens used as backgrounds — skip canvas-contrast audit (meaningless).
  const tBg = (key, fallback) => tok(overrides, key, fallback);
  const fgColor = ghosttyTheme?.foreground ?? t('text', '#cccccc');
  const code12 = ghosttyTheme?.palette?.[12] ?? t('text', '#6699cc');

  const claudeColor = t('claude', '#c4932a');
  const youColor = t('briefLabelYou', '#6699cc');
  const textColor = t('text', '#cccccc');
  const inactiveColor = t('inactive', '#888888');
  const subtleColor = t('subtle', '#666666');
  const successColor = t('success', '#44aa66');
  const errorColor = t('error', '#cc4444');
  const warningColor = t('warning', '#cc8844');
  const permColor = t('permission', '#6699cc');
  const bgToken = t('background', '#00cccc');
  const diffAddBg = tBg('diffAdded', '#1a3a20');
  const diffDelBg = tBg('diffRemoved', '#3a1a18');
  const bashBorder = t('bashBorder', '#c4932a');
  const suggestionColor = t('suggestion', '#9070d0');

  process.stdout.write(`  ${cfg(youColor, '❯')} ${cfg(textColor, 'Can you fix the parser? It crashes on empty input.')}\n\n`);
  process.stdout.write(`  ${cfg(claudeColor, '◆')} ${cfg(claudeColor, 'Thinking…')}\n\n`);
  process.stdout.write(`  ${cfg(claudeColor, '●')} ${cfg(fgColor, 'The crash happens because ')}${cfg(code12, '`parse()`')}${cfg(fgColor, ' doesn’t guard against empty strings.')}\n`);
  process.stdout.write(`    ${cfg(fgColor, 'I’ll add a check at the top of the function.')}\n\n`);

  process.stdout.write(`  ${cfg(permColor, '┌─')} ${cfg(permColor, 'Edit')} ${cfg(inactiveColor, 'src/parser.ts')}\n`);
  process.stdout.write(`  ${cfg(permColor, '│')} ${cbg(diffDelBg, cfg(textColor, '  function parse(input) {                   '))}\n`);
  process.stdout.write(`  ${cfg(permColor, '│')} ${cbg(diffAddBg, cfg(textColor, '  function parse(input) {                   '))}\n`);
  process.stdout.write(`  ${cfg(permColor, '│')} ${cbg(diffAddBg, cfg(textColor, '+   if (!input) return { tokens: [], ok: true };'))}\n`);
  process.stdout.write(`  ${cfg(permColor, '│')}\n`);
  process.stdout.write(`  ${cfg(permColor, '└─')} ${cfg(successColor, '✓ Applied')}\n\n`);

  process.stdout.write(`  ${cfg(bashBorder, '❯')} ${cfg(inactiveColor, 'npm test')}\n`);
  process.stdout.write(`    ${cfg(successColor, '✓ 42 tests passed')} ${cfg(inactiveColor, '(0.8s)')}\n\n`);

  process.stdout.write(`  ${cfg(claudeColor, '●')} ${cfg(fgColor, 'Fixed. The guard returns an empty-but-valid result so downstream')}\n`);
  process.stdout.write(`    ${cfg(fgColor, 'callers don’t need to change.')}\n\n`);

  process.stdout.write(`  ${cfg(subtleColor, '─'.repeat(WIDTH - 4))}\n`);
  process.stdout.write(`  ${cfg(bgToken, '●')} ${cfg(inactiveColor, 'Running')}  `);
  process.stdout.write(`${cfg(successColor, '✓')} ${cfg(inactiveColor, '3 edits')}  `);
  process.stdout.write(`${cfg(warningColor, '⚠')} ${cfg(inactiveColor, '1 warning')}  `);
  process.stdout.write(`${cfg(errorColor, '✗')} ${cfg(inactiveColor, '0 errors')}  `);
  process.stdout.write(`${cfg(suggestionColor, '◆')} ${cfg(inactiveColor, 'suggestion')}\n`);
}
