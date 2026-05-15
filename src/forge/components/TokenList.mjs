// Left pane — collapsible sections with focused row highlight.
// Renders each token with a colored swatch + key + current hex.
import React from 'react';
import { Box, Text } from 'ink';
import { CATALOG } from '../catalog.mjs';
import { visibleTokens } from '../state.mjs';

const h = React.createElement;

const SWATCH = '████';

function rowColor(hex) {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : undefined;
}

export function TokenList({ state }) {
  const visible = visibleTokens(state);
  const focused = visible[state.cursor];
  // Build the display: header per section + each token. Track flat index
  // to align with state.cursor.
  const lines = [];
  let flatIdx = 0;
  for (const { section, tokens } of CATALOG) {
    const isCollapsed = state.collapsed.has(section);
    const visibleInSection = isCollapsed ? [] : tokens.filter((t) => {
      if (!state.filter) return true;
      const n = state.filter.toLowerCase();
      return t.key.toLowerCase().includes(n) || t.label.toLowerCase().includes(n);
    });
    if (visibleInSection.length === 0 && state.filter && !isCollapsed) continue;
    const sigil = isCollapsed ? '▸' : '▾';
    lines.push(h(Text, { key: `s:${section}`, bold: true, color: 'cyan' }, ` ${sigil} ${section}`));
    for (const tok of visibleInSection) {
      const idx = flatIdx++;
      const isFocused = focused && focused.key === tok.key;
      const hex = state.overrides[tok.key];
      const arrow = isFocused ? '►' : ' ';
      const rowChildren = [
        ` ${arrow} `,
        h(Text, { key: 'sw', color: rowColor(hex) }, SWATCH),
        '  ',
        tok.key.padEnd(34, ' ').slice(0, 34),
        '  ',
        hex || '(none)',
      ];
      lines.push(
        h(Text, { key: `t:${tok.key}`, inverse: isFocused, dimColor: !hex }, ...rowChildren),
      );
    }
  }
  if (lines.length === 0) {
    lines.push(h(Text, { dimColor: true }, ` (no tokens match "${state.filter}")`));
  }
  return h(Box, { flexDirection: 'column', paddingX: 1, width: 56, flexShrink: 0 },
    h(Text, { key: 'hdr', bold: true, dimColor: true }, 'TOKENS'),
    ...lines,
  );
}
