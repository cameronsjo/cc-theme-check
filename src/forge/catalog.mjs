// The token catalog drives the TokenList pane. Sections mirror the
// organization in src/render/tokens.mjs so a user navigating the forge
// sees the same groupings they'd see in --tokens output.
//
// `type: 'bg'` marks tokens that are used as backgrounds; the forge
// skips canvas-contrast audits for these (mirrors tBg() in conversation.mjs).
export const CATALOG = [
  {
    section: 'Prompt Borders',
    tokens: [
      { key: 'promptBorder', label: 'default input border' },
      { key: 'bashBorder',   label: 'bash mode (!)' },
      { key: 'planMode',     label: 'plan mode' },
      { key: 'autoAccept',   label: 'auto-accept' },
      { key: 'fastMode',     label: 'fast mode' },
    ],
  },
  {
    section: 'Speaker Labels',
    tokens: [
      { key: 'briefLabelYou',    label: 'You: prefix' },
      { key: 'briefLabelClaude', label: 'claude: prefix' },
    ],
  },
  {
    section: 'Spinner & Status',
    tokens: [
      { key: 'claude',                          label: 'claude (◆ thinking, ⏺ tool dot)' },
      { key: 'claudeBlue_FOR_SYSTEM_SPINNER',   label: 'system spinner' },
      { key: 'background',                      label: 'background indicator' },
      { key: 'inactive',                        label: 'inactive / hints' },
      { key: 'subtle',                          label: 'subtle / borders' },
    ],
  },
  {
    section: 'Text Hierarchy',
    tokens: [
      { key: 'text',       label: 'primary text' },
      { key: 'suggestion', label: 'suggestions / file paths' },
      { key: 'remember',   label: 'CLAUDE.md / memory' },
      { key: 'permission', label: 'permission prompts' },
    ],
  },
  {
    section: 'Status Indicators',
    tokens: [
      { key: 'success', label: '✓ pass / success' },
      { key: 'error',   label: '✗ fail / error' },
      { key: 'warning', label: '⚠ warning' },
      { key: 'merged',  label: '⊕ merged' },
    ],
  },
  {
    section: 'Diff View',
    tokens: [
      { key: 'diffAdded',         label: 'added line bg',         type: 'bg' },
      { key: 'diffAddedDimmed',   label: 'added context bg',      type: 'bg' },
      { key: 'diffAddedWord',     label: 'added word highlight',  type: 'bg' },
      { key: 'diffRemoved',       label: 'removed line bg',       type: 'bg' },
      { key: 'diffRemovedDimmed', label: 'removed context bg',    type: 'bg' },
      { key: 'diffRemovedWord',   label: 'removed word highlight', type: 'bg' },
    ],
  },
  {
    section: 'Subagent Colors',
    tokens: [
      { key: 'red_FOR_SUBAGENTS_ONLY',    label: 'red' },
      { key: 'blue_FOR_SUBAGENTS_ONLY',   label: 'blue' },
      { key: 'green_FOR_SUBAGENTS_ONLY',  label: 'green' },
      { key: 'yellow_FOR_SUBAGENTS_ONLY', label: 'yellow' },
      { key: 'purple_FOR_SUBAGENTS_ONLY', label: 'purple' },
      { key: 'orange_FOR_SUBAGENTS_ONLY', label: 'orange' },
      { key: 'pink_FOR_SUBAGENTS_ONLY',   label: 'pink' },
      { key: 'cyan_FOR_SUBAGENTS_ONLY',   label: 'cyan' },
    ],
  },
  {
    section: 'Rainbow',
    tokens: [
      { key: 'rainbow_red',     label: 'red' },
      { key: 'rainbow_orange',  label: 'orange' },
      { key: 'rainbow_yellow',  label: 'yellow' },
      { key: 'rainbow_green',   label: 'green' },
      { key: 'rainbow_blue',    label: 'blue' },
      { key: 'rainbow_indigo',  label: 'indigo' },
      { key: 'rainbow_violet',  label: 'violet' },
    ],
  },
  {
    section: 'Rainbow Shimmer',
    tokens: [
      { key: 'rainbow_red_shimmer',    label: 'red shimmer' },
      { key: 'rainbow_orange_shimmer', label: 'orange shimmer' },
      { key: 'rainbow_yellow_shimmer', label: 'yellow shimmer' },
      { key: 'rainbow_green_shimmer',  label: 'green shimmer' },
      { key: 'rainbow_blue_shimmer',   label: 'blue shimmer' },
      { key: 'rainbow_indigo_shimmer', label: 'indigo shimmer' },
      { key: 'rainbow_violet_shimmer', label: 'violet shimmer' },
    ],
  },
];

// Flatten the catalog into [{ key, label, section, type }, ...] with
// section dividers omitted. Used for cursor-index navigation in the
// TokenList. Collapsed sections are filtered out by the caller.
export function flatten(catalog, collapsedSections = new Set(), filter = '') {
  const out = [];
  const needle = filter.toLowerCase();
  for (const { section, tokens } of catalog) {
    if (collapsedSections.has(section)) continue;
    for (const tok of tokens) {
      if (needle && !tok.key.toLowerCase().includes(needle) && !tok.label.toLowerCase().includes(needle)) continue;
      out.push({ ...tok, section });
    }
  }
  return out;
}
