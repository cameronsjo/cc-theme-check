// Root launcher component: composes StatusBar + ModeList (or Settings)
// plus the keybind footer. Owns pane + cursor state. When the user picks
// a mode, calls onChoice(action) — index.mjs unmounts and dispatches to
// the chosen mode handler.
import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { debug } from '../../debug.mjs';
import { StatusBar } from './StatusBar.mjs';
import { ModeList } from './ModeList.mjs';
import { Settings } from './Settings.mjs';
import { HelpFooter } from '../../forge/components/HelpFooter.mjs';

const h = React.createElement;

const MENU_KEYS = [
  ['j/k',   'nav'],
  ['enter', 'run'],
  ['s',     'settings'],
  ['q',     'quit'],
];

// Items the cursor can land on. Separators don't stop the cursor.
const ITEMS = [
  { key: 'verify',   label: 'Verify',     description: 'One-shot render + WCAG summary' },
  { key: 'watch',    label: 'Watch',      description: 'Live reload on theme-file save' },
  { key: 'forge',    label: 'Forge',      description: 'Interactive TUI editor' },
  { key: 'init',     label: 'New theme…', description: 'Scaffold from boring-grey template' },
  { key: 'sep1',     separator: true },
  { key: 'settings', label: 'Settings',   description: 'Configure defaults' },
  { key: 'quit',     label: 'Quit',       description: '' },
];

const SELECTABLE = ITEMS
  .map((item, i) => (item.separator ? null : i))
  .filter((i) => i !== null);

function nextSelectable(current, delta) {
  const pos = SELECTABLE.indexOf(current);
  const nextPos = Math.max(0, Math.min(SELECTABLE.length - 1, pos + delta));
  return SELECTABLE[nextPos];
}

export function Menu({ resolved, settings, onChoice }) {
  const { exit } = useApp();
  const [pane, setPane] = React.useState('menu');
  const [cursor, setCursor] = React.useState(SELECTABLE[0]);

  useInput((input, key) => {
    if (pane === 'settings') return; // Settings owns its own input.

    if (input === 'j' || key.downArrow) setCursor((c) => nextSelectable(c, +1));
    else if (input === 'k' || key.upArrow) setCursor((c) => nextSelectable(c, -1));
    else if (input === 's') {
      debug('pane transition', { from: 'menu', to: 'settings' });
      setPane('settings');
    }
    else if (input === 'q') {
      debug('user action', { action: 'quit' });
      onChoice({ action: 'quit' });
      exit();
    }
    else if (key.return) {
      const item = ITEMS[cursor];
      if (!item || item.separator) return;
      if (item.key === 'settings') {
        debug('pane transition', { from: 'menu', to: 'settings' });
        setPane('settings');
        return;
      }
      if (item.key === 'quit') {
        debug('user action', { action: 'quit' });
        onChoice({ action: 'quit' });
        exit();
        return;
      }
      debug('mode selected', { mode: item.key });
      onChoice({ action: item.key });
      exit();
    }
  });

  if (pane === 'settings') {
    return h(Settings, {
      resolved,
      settings,
      onClose: () => {
        debug('pane transition', { from: 'settings', to: 'menu' });
        setPane('menu');
      },
    });
  }

  return h(Box, { flexDirection: 'column' },
    h(StatusBar, { resolved }),
    h(Box, { paddingX: 1, marginTop: 1 }, h(Text, { bold: true, dimColor: true }, 'MODE')),
    h(Box, { paddingX: 1 }, h(Text, { dimColor: true }, '────')),
    h(Box, { paddingX: 1, marginBottom: 1 }, h(ModeList, { items: ITEMS, cursor })),
    h(HelpFooter, { keys: MENU_KEYS }),
  );
}
