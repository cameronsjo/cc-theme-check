import { chalk, cfg, cbg } from '../colorize.mjs';
import { tok, auditContrast, wcagBadge } from '../contrast.mjs';
import { sectionHeader, pad } from './layout.mjs';

export function renderAllTokens(overrides, canvasBg) {
  renderPromptBorders(overrides, canvasBg);
  renderSpeakerLabels(overrides, canvasBg);
  renderSpinnerStatus(overrides, canvasBg);
  renderTextHierarchy(overrides, canvasBg);
  renderStatusIndicators(overrides, canvasBg);
  renderDiffView(overrides, canvasBg);
  renderSubagentColors(overrides, canvasBg);
  renderRainbow(overrides, canvasBg);
}

function tokenLine(hex, sample, sampleWidth, name, canvasBg) {
  const ratio = auditContrast(name, hex, canvasBg);
  const badge = ratio !== null ? wcagBadge(ratio) : '';
  return `  ${cfg(hex, pad(sample, sampleWidth))}  ${chalk.dim(name)}  ${chalk.dim(hex)}  ${badge}\n`;
}

function renderPromptBorders(overrides, canvasBg) {
  sectionHeader('01', 'Prompt Input Borders');
  const borders = [
    { key: 'promptBorder', label: 'default', sample: 'write a test for the parser █' },
    { key: 'bashBorder', label: 'bash', sample: '! npm test' },
    { key: 'planMode', label: 'plan mode', sample: '~ describe the architecture' },
    { key: 'autoAccept', label: 'auto-accept', sample: '⚡ auto-accept is on' },
    { key: 'fastMode', label: 'fast mode', sample: '→ fast mode active' },
  ];
  const boxW = 42;
  for (const { key, label, sample } of borders) {
    const hex = tok(overrides, key, '#555555');
    const ratio = auditContrast(key, hex, canvasBg);
    const badge = ratio !== null ? wcagBadge(ratio) : '';
    const innerW = boxW - 2;
    process.stdout.write(`${cfg(hex, `  ┌─ ${label} ${'─'.repeat(Math.max(0, innerW - label.length - 3))}┐`)}  ${chalk.dim(key)}  ${chalk.dim(hex)}  ${badge}\n`);
    process.stdout.write(`${cfg(hex, `  │ ${pad(sample, innerW - 2)} │`)}\n`);
    process.stdout.write(`${cfg(hex, `  └${'─'.repeat(innerW)}┘`)}\n\n`);
  }
}

function renderSpeakerLabels(overrides, canvasBg) {
  sectionHeader('02', 'Speaker Labels');
  for (const { key, label, sample } of [
    { key: 'briefLabelYou', label: 'You', sample: 'Can you refactor this function?' },
    { key: 'briefLabelClaude', label: 'Claude', sample: "Sure! Here's a cleaner approach…" },
  ]) {
    const hex = tok(overrides, key, '#888888');
    const ratio = auditContrast(key, hex, canvasBg);
    const badge = ratio !== null ? wcagBadge(ratio) : '';
    process.stdout.write(`  ${chalk.bold(cfg(hex, pad(label, 8)))}${cfg(hex, pad(sample, 36))}  ${chalk.dim(key)}  ${chalk.dim(hex)}  ${badge}\n`);
  }
}

function renderSpinnerStatus(overrides, canvasBg) {
  sectionHeader('03', 'Spinner & Status');
  for (const { key, symbol, label, note } of [
    { key: 'claude', symbol: '◆', label: 'Thinking…', note: 'claude' },
    { key: 'claudeBlue_FOR_SYSTEM_SPINNER', symbol: '◆', label: 'Running tool…', note: 'claudeBlue' },
    { key: 'background', symbol: '●', label: 'Running…', note: 'background' },
    { key: 'inactive', symbol: '○', label: '2m ago', note: 'inactive' },
    { key: 'subtle', symbol: '┄', label: 'divider', note: 'subtle' },
  ]) {
    const hex = tok(overrides, key, '#888888');
    const ratio = auditContrast(note, hex, canvasBg);
    const badge = ratio !== null ? wcagBadge(ratio) : '';
    process.stdout.write(`  ${cfg(hex, `${symbol} ${pad(label, 20)}`)}  ${chalk.dim(note)}  ${chalk.dim(hex)}  ${badge}\n`);
  }
}

function renderTextHierarchy(overrides, canvasBg) {
  sectionHeader('04', 'Text Hierarchy');
  for (const { key, sample, note } of [
    { key: 'text', sample: 'Primary text — the default foreground', note: 'text' },
    { key: 'inactive', sample: 'Hints · timestamps · secondary context', note: 'inactive' },
    { key: 'subtle', sample: 'Faint borders and dividers', note: 'subtle' },
    { key: 'suggestion', sample: 'Autocomplete · focused items · file paths', note: 'suggestion' },
    { key: 'remember', sample: 'CLAUDE.md · memory indicators', note: 'remember' },
    { key: 'permission', sample: 'Tool use permission prompts', note: 'permission' },
  ]) {
    process.stdout.write(tokenLine(tok(overrides, key, '#888888'), sample, 48, note, canvasBg));
  }
}

function renderStatusIndicators(overrides, canvasBg) {
  sectionHeader('05', 'Status Indicators');
  for (const { key, symbol, label } of [
    { key: 'success', symbol: '✓', label: 'All tests passed' },
    { key: 'error', symbol: '✗', label: 'Build failed' },
    { key: 'warning', symbol: '⚠', label: 'Rate limit approaching' },
    { key: 'merged', symbol: '⊕', label: 'PR merged' },
  ]) {
    const hex = tok(overrides, key, '#888888');
    const ratio = auditContrast(key, hex, canvasBg);
    const badge = ratio !== null ? wcagBadge(ratio) : '';
    process.stdout.write(`  ${cfg(hex, `${symbol} ${pad(label, 32)}`)}  ${chalk.dim(key)}  ${chalk.dim(hex)}  ${badge}\n`);
  }
}

function renderDiffView(overrides, canvasBg) {
  sectionHeader('06', 'Diff View');
  const addedBg = tok(overrides, 'diffAdded', '#1f3a28');
  const addedDim = tok(overrides, 'diffAddedDimmed', '#1a2a20');
  const addedWord = tok(overrides, 'diffAddedWord', '#2d5a3a');
  const removedBg = tok(overrides, 'diffRemoved', '#3a1f1d');
  const removedDim = tok(overrides, 'diffRemovedDimmed', '#2a1816');
  const removedWord = tok(overrides, 'diffRemovedWord', '#5a2e2a');
  const textHex = tok(overrides, 'text', '#e8e6e1');

  process.stdout.write(`  ${chalk.dim(`─── src/parser.ts ${'─'.repeat(28)}`)}\n`);
  const rows = [
    { prefix: ' ', line: '  const result = parse(input);', bg: addedDim, label: 'diffAddedDimmed', wordBg: null, word: null },
    { prefix: '+', line: '  const result = safeParse(input);', bg: addedBg, label: 'diffAdded', wordBg: addedWord, word: 'safe' },
    { prefix: ' ', line: '  if (result.error) {', bg: removedDim, label: 'diffRemovedDimmed', wordBg: null, word: null },
    { prefix: '-', line: '  if (result.failed) {', bg: removedBg, label: 'diffRemoved', wordBg: removedWord, word: 'failed' },
  ];
  for (const { prefix, line, bg, label, wordBg, word } of rows) {
    let rendered;
    if (wordBg && word && line.includes(word)) {
      const parts = line.split(word);
      rendered = cbg(bg, cfg(textHex, `${prefix} ${parts[0]}`)) + chalk.bold(cbg(wordBg, cfg(textHex, word))) + cbg(bg, cfg(textHex, `${parts[1]}${' '.repeat(Math.max(0, 40 - line.length))}`));
    } else {
      rendered = cbg(bg, cfg(textHex, `${prefix} ${line}${' '.repeat(Math.max(0, 40 - line.length))}`));
    }
    process.stdout.write(`  ${rendered}  ${chalk.dim(label)}\n`);
  }
}

function renderSubagentColors(overrides, canvasBg) {
  sectionHeader('07', 'Subagent Colors');
  let line = '  ';
  for (const { key, label } of [
    { key: 'red_FOR_SUBAGENTS_ONLY', label: 'red' }, { key: 'blue_FOR_SUBAGENTS_ONLY', label: 'blue' },
    { key: 'green_FOR_SUBAGENTS_ONLY', label: 'green' }, { key: 'yellow_FOR_SUBAGENTS_ONLY', label: 'yellow' },
    { key: 'purple_FOR_SUBAGENTS_ONLY', label: 'purple' }, { key: 'orange_FOR_SUBAGENTS_ONLY', label: 'orange' },
    { key: 'pink_FOR_SUBAGENTS_ONLY', label: 'pink' }, { key: 'cyan_FOR_SUBAGENTS_ONLY', label: 'cyan' },
  ]) {
    line += `${cfg(tok(overrides, key, '#888888'), `■ ${label}`)}  `;
  }
  process.stdout.write(line + '\n');
}

function renderRainbow(overrides, canvasBg) {
  sectionHeader('08', 'Rainbow');
  const keys = ['rainbow_red', 'rainbow_orange', 'rainbow_yellow', 'rainbow_green', 'rainbow_blue', 'rainbow_indigo', 'rainbow_violet'];
  let line = '  ';
  for (const key of keys) line += `${cfg(tok(overrides, key, '#888888'), '■')} `;
  process.stdout.write(line + ` ${chalk.dim('rainbow_red → rainbow_violet')}\n`);

  let shimmerLine = '  ';
  for (const key of keys.map(k => k + '_shimmer')) shimmerLine += `${cfg(tok(overrides, key, '#888888'), '■')} `;
  process.stdout.write(shimmerLine + ` ${chalk.dim('shimmers')}\n`);
}
