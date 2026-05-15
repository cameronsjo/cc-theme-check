// Bottom row — shows the focused token, accepts a hex via TextInput in
// edit mode, and renders live WCAG feedback as the user types.
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { contrastRatio, isValidHex, wcagBucket } from '../../contrast.mjs';
import { focusedToken } from '../state.mjs';

const h = React.createElement;

// Color name mapping for Ink. The shared `wcagBucket` returns hex codes
// (used by the chalk badge); Ink doesn't render arbitrary hex in `color`
// reliably, so we route the three bucket labels to named Ink colors.
const INK_COLOR = { AA: 'green', aa: 'yellow', FAIL: 'red' };

function wcagBadge(ratio) {
  const { label } = wcagBucket(ratio);
  const text = label === 'aa' ? `${ratio.toFixed(1)}:1 aa (large)` : `${ratio.toFixed(1)}:1 ${label}`;
  return h(Text, { color: INK_COLOR[label] }, text);
}

function wcagLine(state, tok, ratio) {
  if (ratio !== null) {
    return h(Box, null,
      h(Text, null, '  wcag:    '),
      wcagBadge(ratio),
      h(Text, { dimColor: true }, `  on ${state.canvasBg}`),
    );
  }
  if (tok.type === 'bg') {
    return h(Text, { dimColor: true }, '  wcag:    (background-only — audit skipped)');
  }
  return h(Text, { dimColor: true }, '  wcag:    —');
}

export function EditRow({ state, dispatch }) {
  const tok = focusedToken(state);
  if (!tok) {
    return h(Box, { paddingX: 1 }, h(Text, { dimColor: true }, '(no token focused)'));
  }

  const current = state.overrides[tok.key];
  const editing = state.edit && state.edit.tokenKey === tok.key;
  const draft = editing ? state.edit.draftHex : '';

  // Use draft hex while editing (for live feedback), saved hex otherwise.
  const previewHex = editing ? (isValidHex(draft) ? draft : null) : current;
  const showRatio = previewHex && tok.type !== 'bg' && isValidHex(state.canvasBg);
  const ratio = showRatio ? contrastRatio(previewHex, state.canvasBg) : null;

  return h(Box, { flexDirection: 'column', paddingX: 1, borderStyle: 'single', borderColor: 'gray', flexShrink: 0 },
    h(Text, { bold: true },
      'EDIT: ',
      h(Text, { color: 'cyan' }, tok.key),
      h(Text, { dimColor: true }, `  · ${tok.label}`),
    ),
    h(Box, null,
      h(Text, null, '  current: '),
      h(Text, { color: current }, current ? '████ ' : '(none) '),
      h(Text, { dimColor: true }, current ?? '— inherits base —'),
    ),
    editing
      ? h(Box, null,
          h(Text, null, '  new:     '),
          h(Text, null, '#'),
          h(TextInput, {
            value: draft.replace(/^#/, ''),
            onChange: (v) => {
              const cleaned = v.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
              // Empty cleaned -> empty string (no '#'), so COMMIT_EDIT
              // can hit the deletion branch (hex === '' -> drop override).
              dispatch({ type: 'EDIT_INPUT', value: cleaned ? '#' + cleaned : '' });
            },
            onSubmit: () => dispatch({ type: 'COMMIT_EDIT' }),
          }),
          isValidHex(draft) && h(Text, null, '  '),
          isValidHex(draft) && h(Text, { color: draft }, '████'),
        )
      : h(Text, { dimColor: true }, '  press [enter] to edit'),
    wcagLine(state, tok, ratio),
    state.status && h(Text, { color: 'yellow' }, `  · ${state.status}`),
  );
}
