import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const KEYS = [
  ['j/k',   'move'],
  ['enter', 'edit'],
  ['esc',   'cancel'],
  ['h',     'collapse'],
  ['s',     'save'],
  ['u/U',   'undo/redo'],
  ['/',     'filter'],
  ['q',     'quit'],
];

export function HelpFooter() {
  return h(Box, { paddingX: 1 },
    ...KEYS.map(([k, label], i) =>
      h(Text, { key: k, dimColor: true },
        i > 0 ? '  ' : '',
        h(Text, { key: 'k', color: 'cyan' }, `[${k}]`),
        ` ${label}`,
      ),
    ),
  );
}
