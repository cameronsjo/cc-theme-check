// Root component — owns the reducer + keyboard, lays out the four panes.
//
// Layout:
//   ┌──────────────┬───────────────────────────┐
//   │  TokenList   │  Preview (chalk render)   │
//   └──────────────┴───────────────────────────┘
//   ┌────────────────────────────────────────────┐
//   │  EditRow (hex input + live WCAG)          │
//   └────────────────────────────────────────────┘
//   HelpFooter (keybinds)
import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { writeFile } from 'node:fs/promises';
import { reducer, initialState, focusedToken, visibleTokens, isDirty } from '../state.mjs';
import { TokenList } from './TokenList.mjs';
import { Preview } from './Preview.mjs';
import { EditRow } from './EditRow.mjs';
import { HelpFooter } from './HelpFooter.mjs';

const h = React.createElement;

function TitleBar({ state }) {
  const dirty = isDirty(state);
  return h(Box, { paddingX: 1, justifyContent: 'space-between' },
    h(Text, { bold: true },
      h(Text, { color: 'magenta' }, '✦ forge'),
      h(Text, { dimColor: true }, '  ·  '),
      h(Text, null, state.themePath),
      dirty && h(Text, { color: 'yellow' }, '  [modified]'),
    ),
    h(Text, { dimColor: true }, state.filter ? `filter: ${state.filter}` : ''),
  );
}

async function saveToDisk({ themePath, themeRaw }, snapshot) {
  const next = { ...themeRaw, overrides: snapshot };
  await writeFile(themePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

export function Forge({ initialProps }) {
  const [state, dispatch] = React.useReducer(reducer, initialProps, initialState);
  const { exit } = useApp();
  const [filterMode, setFilterMode] = React.useState(false);
  const [filterDraft, setFilterDraft] = React.useState('');

  useInput((input, key) => {
    // Filter entry mode — TextInput-ish behavior on this single character path.
    if (filterMode) {
      if (key.escape) { setFilterMode(false); setFilterDraft(''); dispatch({ type: 'CLEAR_FILTER' }); return; }
      if (key.return) { setFilterMode(false); return; }
      if (key.backspace || key.delete) {
        const next = filterDraft.slice(0, -1);
        setFilterDraft(next);
        dispatch({ type: 'SET_FILTER', value: next });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        const next = filterDraft + input;
        setFilterDraft(next);
        dispatch({ type: 'SET_FILTER', value: next });
      }
      return;
    }

    // Edit mode — most keys handled by the TextInput in EditRow.
    // We still intercept Escape here.
    if (state.edit) {
      if (key.escape) dispatch({ type: 'CANCEL_EDIT' });
      return;
    }

    // Navigation + actions
    if (input === 'j' || key.downArrow) dispatch({ type: 'CURSOR_DOWN' });
    else if (input === 'k' || key.upArrow) dispatch({ type: 'CURSOR_UP' });
    else if (key.return) dispatch({ type: 'BEGIN_EDIT' });
    else if (input === 'h') {
      const tok = focusedToken(state);
      if (tok) dispatch({ type: 'TOGGLE_SECTION', section: tok.section });
    }
    else if (input === 'u') dispatch({ type: 'UNDO' });
    else if (input === 'U') dispatch({ type: 'REDO' });
    else if (input === '/') { setFilterMode(true); setFilterDraft(state.filter); }
    else if (input === 's') {
      // Capture the snapshot we're about to write so SAVE_SUCCESS can
      // baseline against the exact bytes on disk — not whatever the
      // user has typed by the time writeFile resolves.
      const snapshot = { ...state.overrides };
      saveToDisk(state, snapshot).then(
        () => dispatch({ type: 'SAVE_SUCCESS', snapshot }),
        (err) => dispatch({ type: 'SAVE_FAIL', error: err.message }),
      );
    }
    else if (input === 'q') {
      if (isDirty(state) && !state.quitConfirm) {
        dispatch({ type: 'QUIT_CONFIRM' });
      } else {
        exit();
      }
    }
  });

  // If filter is empty after deleting all chars, leave filter mode.
  React.useEffect(() => {
    if (filterMode && filterDraft === '') {
      // stay in filterMode but show prompt
    }
  }, [filterMode, filterDraft]);

  const tokens = visibleTokens(state);
  if (tokens.length === 0 && !state.filter) {
    return h(Box, { padding: 1 }, h(Text, { color: 'red' }, 'No tokens — check catalog.'));
  }

  return h(Box, { flexDirection: 'column' },
    h(TitleBar, { state }),
    h(Box, { flexDirection: 'row', flexGrow: 1 },
      h(TokenList, { state }),
      h(Preview, { state }),
    ),
    h(EditRow, { state, dispatch }),
    filterMode
      ? h(Box, { paddingX: 1 }, h(Text, { color: 'yellow' }, `filter: ${filterDraft}_  `), h(Text, { dimColor: true }, '[enter] apply  [esc] clear'))
      : h(HelpFooter, null),
  );
}
