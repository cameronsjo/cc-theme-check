// Left pane — collapsible sections with focused row highlight.
// Renders each token with a colored swatch + key + current hex.
import React from 'react';
import { Box, Text } from 'ink';
import { isValidHex } from '../../contrast.mjs';
import { CATALOG } from '../catalog.mjs';
import { visibleTokens } from '../state.mjs';

const h = React.createElement;

const SWATCH = '████';

// Sections that match the filter but have all their tokens hidden by it
// still need a header rendered (so the user knows the section exists).
// We compute collapsed-state separately for that case.
function isSectionVisible(section, state) {
  if (state.collapsed.has(section)) return false;
  if (!state.filter) return true;
  const n = state.filter.toLowerCase();
  return CATALOG
    .find((s) => s.section === section)
    ?.tokens.some((t) => t.key.toLowerCase().includes(n) || t.label.toLowerCase().includes(n));
}

export function TokenList({ state }) {
  const visible = visibleTokens(state);
  const focused = visible[state.cursor];
  const lines = [];

  // Emit a header per section. Collapsed sections still get a header so
  // the user sees the structure; expanded-but-empty (no filter matches)
  // sections are skipped via isSectionVisible.
  for (const { section } of CATALOG) {
    const isCollapsed = state.collapsed.has(section);
    if (!isSectionVisible(section, state) && !isCollapsed) continue;
    const sigil = isCollapsed ? '▸' : '▾';
    lines.push(h(Text, { key: `s:${section}`, bold: true, color: 'cyan' }, ` ${sigil} ${section}`));
    if (isCollapsed) continue;
    for (const tok of visible.filter((t) => t.section === section)) {
      const isFocused = focused && focused.key === tok.key;
      const hex = state.overrides[tok.key];
      const arrow = isFocused ? '►' : ' ';
      const swatchColor = isValidHex(hex) ? hex : undefined;
      const rowChildren = [
        ` ${arrow} `,
        h(Text, { key: 'sw', color: swatchColor }, SWATCH),
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
