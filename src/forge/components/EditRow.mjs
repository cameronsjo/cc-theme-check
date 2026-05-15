// Bottom row — shows the focused token, accepts a hex via TextInput in
// edit mode, and renders live WCAG feedback as the user types.
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { contrastRatio, isValidHex } from '../../contrast.mjs';
import { focusedToken } from '../state.mjs';

const h = React.createElement;

function wcagBadge(ratio) {
  if (ratio >= 4.5) return h(Text, { color: 'green' },  `${ratio.toFixed(1)}:1 AA`);
  if (ratio >= 3.0) return h(Text, { color: 'yellow' }, `${ratio.toFixed(1)}:1 aa (large)`);
  return h(Text, { color: 'red' }, `${ratio.toFixed(1)}:1 FAIL`);
}

export function EditRow({ state, dispatch }) {
  const tok = focusedToken(state);
  if (!tok) {
    return h(Box, { paddingX: 1 }, h(Text, { dimColor: true }, '(no token focused)'));
  }

  const current = state.overrides[tok.key];
  const editing = state.edit && state.edit.tokenKey === tok.key;
  const draft = editing ? state.edit.draftHex : '';

  // WCAG line — use draft hex if currently editing, otherwise the saved hex.
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
            onChange: (v) => dispatch({ type: 'EDIT_INPUT', value: '#' + v.replace(/[^0-9a-fA-F]/g, '').slice(0, 6) }),
            onSubmit: () => dispatch({ type: 'COMMIT_EDIT' }),
          }),
          isValidHex(draft) && h(Text, null, '  '),
          isValidHex(draft) && h(Text, { color: draft }, '████'),
        )
      : h(Text, { dimColor: true }, '  press [enter] to edit'),
    showRatio && ratio !== null
      ? h(Box, null,
          h(Text, null, '  wcag:    '),
          wcagBadge(ratio),
          h(Text, { dimColor: true }, `  on ${state.canvasBg}`),
        )
      : tok.type === 'bg'
        ? h(Text, { dimColor: true }, '  wcag:    (background-only — audit skipped)')
        : h(Text, { dimColor: true }, '  wcag:    —'),
    state.status && h(Text, { color: 'yellow' }, `  · ${state.status}`),
  );
}
