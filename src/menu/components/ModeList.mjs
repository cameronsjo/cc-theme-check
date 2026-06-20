// Controlled vim-keyed list for the launcher's main mode picker.
// Parent owns cursor state and keyboard handling — this is pure render.
import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const GLYPH   = '❯';
const RULE    = '──────';
const LABEL_W = 14; // width reserved for label column

export function ModeList({ items, cursor }) {
  const rows = items.map((item, i) => {
    if (item.separator) {
      return h(Text, { key: `sep:${i}`, dimColor: true }, `  ${RULE}`);
    }

    const focused = i === cursor;
    const glyph   = focused ? GLYPH : ' ';
    const label   = item.label.padEnd(LABEL_W, ' ');

    if (focused) {
      // Magenta accent on the cursor glyph; bold label; dim description
      return h(
        Box,
        { key: item.key },
        h(Text, { color: 'magenta', bold: true }, `${glyph} `),
        h(Text, { bold: true }, label),
        item.description
          ? h(Text, { dimColor: true }, item.description)
          : null,
      );
    }

    return h(
      Box,
      { key: item.key },
      h(Text, {}, `  ${label}`),
      item.description
        ? h(Text, { dimColor: true }, item.description)
        : null,
    );
  });

  return h(Box, { flexDirection: 'column' }, ...rows);
}
