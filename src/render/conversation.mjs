import { chalk, cfg, cbg } from '../colorize.mjs';
import { tok, auditContrast } from '../contrast.mjs';
import { sectionHeader, glyphs, WIDTH } from './layout.mjs';

const RAINBOW_KEYS = [
  'rainbow_red', 'rainbow_orange', 'rainbow_yellow',
  'rainbow_green', 'rainbow_blue', 'rainbow_indigo', 'rainbow_violet',
];

export function renderConversation(overrides, canvasBg, ghosttyTheme) {
  sectionHeader('✦', 'Mock Conversation');

  const t = (key, fallback) => {
    const hex = tok(overrides, key, fallback);
    if (hex) auditContrast(key, hex, canvasBg);
    return hex;
  };
  const tBg = (key, fallback) => tok(overrides, key, fallback);

  const g = glyphs();
  const fgColor      = ghosttyTheme?.foreground ?? t('text', '#cccccc');
  const text         = t('text', '#cccccc');
  const claudeC      = t('claude', '#888888');
  const inactive     = t('inactive', '#888888');
  const subtle       = t('subtle', '#666666');
  const success      = t('success', '#888888');
  const warning      = t('warning', '#888888');
  const merged       = t('merged', '#888888');
  const youLabel     = t('briefLabelYou', '#888888');
  const claudeLabel  = t('briefLabelClaude', '#888888');
  const permission   = t('permission', '#888888');
  const promptBorder = t('promptBorder', '#666666');
  const autoAccept   = t('autoAccept', '#888888');
  const suggestion   = t('suggestion', '#888888');
  const remember     = t('remember', '#888888');
  const subagentBlue = t('blue_FOR_SUBAGENTS_ONLY', '#888888');

  const diffAdd     = tBg('diffAdded',         '#1a3a20');
  const diffAddDim  = tBg('diffAddedDimmed',   '#1a2a20');
  const diffAddWord = tBg('diffAddedWord',     '#2d5a3a');
  const diffDel     = tBg('diffRemoved',       '#3a1a18');
  const diffDelDim  = tBg('diffRemovedDimmed', '#2a1816');
  const diffDelWord = tBg('diffRemovedWord',   '#5a2e2a');

  // ── User prompt with brief-mode label and rainbow ultrathink ──
  const rainbowHexes = RAINBOW_KEYS.map((k) => t(k, '#888888'));
  const rainbow = (word) => [...word]
    .map((ch, i) => cfg(rainbowHexes[i % rainbowHexes.length], ch))
    .join('');

  process.stdout.write(
    `  ${chalk.bold(cfg(youLabel, 'You:'))} ${cfg(text, 'Help me fix the parser. Please ')}` +
    `${rainbow('ultrathink')}${cfg(text, ' this one.')}\n\n`
  );

  // ── Claude thinking ──
  process.stdout.write(`  ${cfg(claudeC, g.thinkingDot)} ${cfg(claudeC, 'Thinking…')}\n\n`);

  // ── Read tool (file peek with dimmed connector) ──
  toolCall(g, claudeC, inactive, 'Read', 'src/parser.ts');
  toolResult(g, subtle, inactive, 'Read 145 lines');

  // ── Claude commentary with inline code-like span ──
  process.stdout.write(
    `  ${cfg(claudeC, g.toolDot)} ${cfg(text, 'The crash happens because ')}` +
    `${cfg(suggestion, '`parse()`')}${cfg(text, " doesn't guard against empty strings.")}\n\n`
  );

  // ── Edit tool with diff rows ──
  toolCall(g, claudeC, inactive, 'Edit', 'src/parser.ts');
  diffRow(diffAddDim, text, ' ', '  function parse(input) {');
  diffRow(diffAdd,    text, '+', '    if (!input) return { tokens: [], ok: true };', diffAddWord, 'input');
  diffRow(diffDelDim, text, ' ', '  const result = parse(rawInput);');
  diffRow(diffDel,    text, '-', '  const result = oldParse(rawInput);',              diffDelWord, 'oldParse');
  toolResultOk(g, subtle, success, '✓ Applied');

  // ── Permission prompt (the legitimate place for a box) ──
  permissionPrompt(permission, promptBorder, text, inactive);

  // ── Bash tool ──
  toolCall(g, claudeC, inactive, 'Bash', 'npm test');
  toolResultOk(g, subtle, success, '✓ 42 tests passed');

  // ── Subagent dispatch (exercises *_FOR_SUBAGENTS_ONLY) ──
  toolCallColored(g, claudeC, subagentBlue, inactive, 'Task', 'Explore — survey repo');
  toolResult(g, subtle, inactive, 'Done (12 tool uses)');

  // ── Final response with merged badge ──
  process.stdout.write(
    `  ${cfg(claudeC, g.toolDot)} ${cfg(text, 'Fixed. The guard returns an empty-but-valid result so downstream')}\n`
  );
  process.stdout.write(
    `    ${cfg(text, "callers don't need to change. ")}${cfg(merged, '⊕')} ${cfg(text, 'main is clean.')}\n\n`
  );

  // ── Brief-mode follow-up exercising claudeLabel + remember + warning ──
  process.stdout.write(
    `  ${chalk.bold(cfg(claudeLabel, 'claude:'))} ${cfg(text, "I'll note this in ")}` +
    `${cfg(remember, 'CLAUDE.md')}${cfg(text, '. ')}` +
    `${cfg(warning, '⚠')} ${cfg(inactive, 'Heads up: rate-limit approaching.')}\n\n`
  );

  // ── Status footer ──
  statusFooter(subtle, inactive, success, autoAccept);
}

function toolCall(g, dotColor, argColor, name, arg) {
  process.stdout.write(
    `  ${cfg(dotColor, g.toolDot)} ${chalk.bold(cfg(dotColor, name))}${cfg(argColor, `(${arg})`)}\n`
  );
}

function toolCallColored(g, dotColor, nameColor, argColor, name, arg) {
  process.stdout.write(
    `  ${cfg(dotColor, g.toolDot)} ${chalk.bold(cfg(nameColor, name))}${cfg(argColor, `(${arg})`)}\n`
  );
}

function toolResult(g, connectorColor, contentColor, message) {
  process.stdout.write(
    `    ${chalk.dim(cfg(connectorColor, g.connector))}  ${cfg(contentColor, message)}\n\n`
  );
}

function toolResultOk(g, connectorColor, okColor, message) {
  process.stdout.write(
    `    ${chalk.dim(cfg(connectorColor, g.connector))}  ${cfg(okColor, message)}\n\n`
  );
}

function diffRow(bg, textColor, prefix, line, wordBg, word) {
  const PAD = 60;
  const visibleLen = (prefix + ' ' + line).length;
  const padding = ' '.repeat(Math.max(0, PAD - visibleLen));

  if (wordBg && word && line.includes(word)) {
    const [head, tail] = line.split(word);
    const left  = cbg(bg,     cfg(textColor, `${prefix} ${head}`));
    const mid   = chalk.bold(cbg(wordBg, cfg(textColor, word)));
    const right = cbg(bg,     cfg(textColor, `${tail}${padding}`));
    process.stdout.write(`    ${left}${mid}${right}\n`);
  } else {
    const rendered = cbg(bg, cfg(textColor, `${prefix} ${line}${padding}`));
    process.stdout.write(`    ${rendered}\n`);
  }
}

function permissionPrompt(permColor, borderColor, textColor, dimColor) {
  const W_OUT = 42;
  const innerW = W_OUT - 4; // accounts for "│ " ... " │"
  const topLabel = '╭─ Edit ';
  const top = topLabel + '─'.repeat(W_OUT - topLabel.length - 1) + '╮';
  const bot = '╰' + '─'.repeat(W_OUT - 2) + '╯';

  const row = (colored) => {
    const stripped = colored.replace(/\x1b\[[0-9;]*m/g, '');
    const pad = ' '.repeat(Math.max(0, innerW - stripped.length));
    return `${cfg(borderColor, '│')} ${colored}${pad} ${cfg(borderColor, '│')}`;
  };

  process.stdout.write(`  ${cfg(borderColor, top)}\n`);
  process.stdout.write(`  ${row(cfg(permColor, 'Allow Edit on src/parser.ts?'))}\n`);
  process.stdout.write(`  ${row(cfg(permColor, '❯ 1. Yes'))}\n`);
  process.stdout.write(`  ${row(cfg(dimColor, "  2. Yes, and don't ask again"))}\n`);
  process.stdout.write(`  ${row(cfg(dimColor, '  3. No'))}\n`);
  process.stdout.write(`  ${cfg(borderColor, bot)}\n\n`);
}

function statusFooter(subtleColor, inactiveColor, successColor, autoAcceptColor) {
  process.stdout.write(`  ${cfg(subtleColor, '─'.repeat(WIDTH - 4))}\n`);
  const sep = cfg(subtleColor, '│');
  process.stdout.write(
    `  ${cfg(inactiveColor, 'claude-opus-4-7')} ${sep} ` +
    `${cfg(successColor, '12.4k tokens')} ${sep} ` +
    `${cfg(inactiveColor, '⎇ main')} ${sep} ` +
    `${cfg(autoAcceptColor, '⏵⏵ auto-accept')}\n`
  );
}
