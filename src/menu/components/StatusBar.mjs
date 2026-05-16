// StatusBar — launcher header showing auto-detected environment context.
// Props: { resolved } — the full output of resolveOptions().
import { homedir } from 'node:os';
import { basename } from 'node:path';
import React from 'react';
import { Box, Text } from 'ink';
import { chalkLevelLabel } from '../../colorize.mjs';

const h = React.createElement;

const HOME = homedir();
const THEMES_DIR = `${HOME}/.claude/themes/`;

function toHomeRelative(p) {
  return p.startsWith(HOME) ? p.replace(HOME, '~') : p;
}

function themeLabel(themePath) {
  if (!themePath) return null;
  if (themePath.startsWith(THEMES_DIR)) {
    const slug = basename(themePath, '.json');
    return { label: `custom:${slug}`, path: toHomeRelative(themePath) };
  }
  return { label: toHomeRelative(themePath), path: null };
}

export function StatusBar({ resolved }) {
  const { themePath, bgOverride, autodetect, sources } = resolved;
  const { ghostty, terminal } = autodetect ?? {};

  const theme = themeLabel(themePath);
  const isTmux = terminal?.isTmux ?? false;

  return h(Box, { flexDirection: 'column', paddingX: 1, paddingY: 0 },

    // Row 1 — Theme
    theme && h(Box, { key: 'theme' },
      h(Text, { color: 'magenta' }, '✦ '),
      h(Text, { bold: true }, 'Theme: '),
      h(Text, null, theme.label),
      theme.path && h(Text, { dimColor: true }, `  (${theme.path})`),
    ),

    // Row 2 — Terminal + tmux
    terminal?.name && h(Box, { key: 'terminal' },
      h(Text, { bold: true }, 'Terminal: '),
      h(Text, null, terminal.name),
      isTmux && h(React.Fragment, { key: 'tmux' },
        h(Text, { dimColor: true }, '  ·  '),
        h(Text, null, `tmux: yes`),
        h(Text, { dimColor: true }, `  (${chalkLevelLabel()})`),
      ),
    ),

    // Row 3 — Ghostty theme + canvas bg (omit entirely if not detected)
    ghostty?.themeName && h(Box, { key: 'ghostty' },
      h(Text, { bold: true }, 'Ghostty theme: '),
      h(Text, null, ghostty.themeName),
      bgOverride && h(React.Fragment, { key: 'bg' },
        h(Text, { dimColor: true }, '  ·  '),
        h(Text, { bold: true }, 'canvas bg: '),
        h(Text, null, bgOverride),
        sources?.bgOverride && sources.bgOverride !== 'default' &&
          h(Text, { dimColor: true }, `  (via ${sources.bgOverride})`),
      ),
    ),

  );
}
