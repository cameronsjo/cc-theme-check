import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const FORGE_KEYS = [
  ['j/k',   'move'],
  ['enter', 'edit'],
  ['esc',   'cancel'],
  ['h',     'collapse'],
  ['s',     'save'],
  ['u/U',   'undo/redo'],
  ['/',     'filter'],
  ['q',     'quit'],
];

export function HelpFooter({ keys = FORGE_KEYS } = {}) {
  return h(Box, { paddingX: 1 },
    ...keys.map(([k, label], i) =>
      h(Text, { key: k, dimColor: true },
        i > 0 ? '  ' : '',
        h(Text, { key: 'k', color: 'cyan' }, `[${k}]`),
        ` ${label}`,
      ),
    ),
  );
}
