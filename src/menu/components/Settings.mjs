// Settings editor pane for the launcher menu.
// Exposes the six user-configurable fields from resolved config with a
// field grid, inline edit row, and save status line.
import React from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { saveConfig } from '../../config.mjs';

const h = React.createElement;

// ─── Field definitions ────────────────────────────────────────────────────────

const FIELDS = [
  { key: 'ghosttyTheme',           label: 'Ghostty theme',  type: 'string'  },
  { key: 'bgOverride',             label: 'Canvas bg',      type: 'string'  },
  { key: 'defaultFlags.audit',     label: 'Default audit',  type: 'boolean' },
  { key: 'defaultFlags.palette',   label: 'Default palette',type: 'boolean' },
  { key: 'defaultFlags.tokens',    label: 'Default tokens', type: 'boolean' },
  { key: 'themePath',              label: 'Theme path',     type: 'string'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getField(settings, fieldKey) {
  if (fieldKey.startsWith('defaultFlags.')) {
    const flag = fieldKey.split('.')[1];
    return settings.defaultFlags?.[flag] ?? false;
  }
  return settings[fieldKey] ?? '';
}

function setField(settings, fieldKey, value) {
  if (fieldKey.startsWith('defaultFlags.')) {
    const flag = fieldKey.split('.')[1];
    return {
      ...settings,
      defaultFlags: { ...settings.defaultFlags, [flag]: value },
    };
  }
  return { ...settings, [fieldKey]: value };
}

function deleteField(settings, fieldKey) {
  if (fieldKey.startsWith('defaultFlags.')) {
    const flag = fieldKey.split('.')[1];
    const next = { ...settings.defaultFlags };
    delete next[flag];
    return { ...settings, defaultFlags: next };
  }
  const next = { ...settings };
  delete next[fieldKey];
  return next;
}

function sourceLabel(resolved, fieldKey, workingSettings, baseline) {
  // resolveOptions emits flat-name source keys (sources.audit, sources.ghosttyPath, …).
  // Map our nested fieldKeys back to the flat source name they correspond to.
  const flatKey = fieldKey.startsWith('defaultFlags.')
    ? fieldKey.split('.')[1]              // defaultFlags.audit -> audit
    : fieldKey === 'ghosttyTheme' ? 'ghosttyPath'
    : fieldKey;
  const src = resolved?.sources?.[flatKey] ?? 'default';
  const isDirty = JSON.stringify(getField(workingSettings, fieldKey)) !==
                  JSON.stringify(getField(baseline, fieldKey));
  if (isDirty) return 'settings*';
  return src;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function initialState({ settings }) {
  // The baseline is the user's saved config schema (loaded by the parent
  // via loadConfig). Editing produces a working copy of the same shape;
  // saveConfig writes the schema back unchanged on `s`.
  const base = {
    ghosttyTheme:  settings?.ghosttyTheme  ?? undefined,
    bgOverride:    settings?.bgOverride    ?? undefined,
    themePath:     settings?.themePath     ?? undefined,
    defaultFlags:  { ...(settings?.defaultFlags ?? {}) },
  };
  return {
    working:   { ...base },
    baseline:  { ...base },
    cursor:    0,
    edit:      null,
    saveState: null,
    statusTimer: null,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'CURSOR_UP':
      return { ...state, cursor: Math.max(state.cursor - 1, 0) };
    case 'CURSOR_DOWN':
      return { ...state, cursor: Math.min(state.cursor + 1, FIELDS.length - 1) };

    case 'BEGIN_EDIT': {
      const field = FIELDS[state.cursor];
      if (!field) return state;
      if (field.type === 'boolean') {
        // Toggle immediately, no edit mode.
        const current = getField(state.working, field.key);
        return { ...state, working: setField(state.working, field.key, !current) };
      }
      const current = getField(state.working, field.key);
      return { ...state, edit: { fieldKey: field.key, draft: String(current ?? '') } };
    }

    case 'UPDATE_DRAFT':
      if (!state.edit) return state;
      return { ...state, edit: { ...state.edit, draft: action.value } };

    case 'COMMIT_EDIT': {
      if (!state.edit) return state;
      const { fieldKey, draft } = state.edit;
      const next = draft === ''
        ? deleteField(state.working, fieldKey)
        : setField(state.working, fieldKey, draft);
      return { ...state, working: next, edit: null };
    }

    case 'CANCEL_EDIT':
      return { ...state, edit: null };

    case 'DELETE_FIELD': {
      const field = FIELDS[state.cursor];
      if (!field) return state;
      return { ...state, working: deleteField(state.working, field.key) };
    }

    case 'SAVE_START':
      return { ...state, saveState: 'saving' };
    case 'SAVE_SUCCESS':
      return { ...state, saveState: { ok: true }, baseline: { ...state.working } };
    case 'SAVE_FAIL':
      return { ...state, saveState: { ok: false, error: action.error } };
    case 'CLEAR_STATUS':
      return { ...state, saveState: null };

    default:
      return state;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({ field, isCursor, value, source }) {
  const label  = field.label.padEnd(18);
  const valStr = value === '' || value === undefined || value === null
    ? '—'
    : String(value);
  const displayVal = valStr.length > 28 ? '…' + valStr.slice(-(27)) : valStr.padEnd(28);

  return h(Box, { paddingX: 2 },
    h(Text, { color: isCursor ? 'cyan' : undefined },
      isCursor ? '❯ ' : '  ',
      h(Text, { bold: isCursor }, label),
      h(Text, { color: isCursor ? 'white' : 'gray' }, displayVal),
      h(Text, { dimColor: true }, source),
    ),
  );
}

function EditRowInline({ field, draft, dispatch }) {
  return h(Box, { paddingX: 2, flexDirection: 'column' },
    h(Box, null,
      h(Text, { color: 'cyan' }, `  editing: ${field.label}  `),
      h(TextInput, {
        value: draft,
        onChange: (v) => dispatch({ type: 'UPDATE_DRAFT', value: v }),
        onSubmit:  () => dispatch({ type: 'COMMIT_EDIT' }),
      }),
    ),
    h(Text, { dimColor: true }, '  [enter] commit  [esc] cancel'),
  );
}

function StatusLine({ saveState }) {
  if (!saveState || saveState === 'saving') {
    const msg = saveState === 'saving' ? 'Saving…' : '';
    return h(Box, { paddingX: 2 }, h(Text, { dimColor: true }, msg || ' '));
  }
  if (saveState.ok) {
    return h(Box, { paddingX: 2 }, h(Text, { color: 'green' }, 'Saved ✓'));
  }
  return h(Box, { paddingX: 2 }, h(Text, { color: 'red' }, `Save failed: ${saveState.error}`));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Settings({ resolved, settings, onClose }) {
  const [state, dispatch] = React.useReducer(reducer, { settings }, initialState);
  const saveInFlightRef   = React.useRef(false);
  const timerRef          = React.useRef(null);

  // Auto-clear status after 2s.
  React.useEffect(() => {
    if (state.saveState && state.saveState !== 'saving') {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_STATUS' }), 2000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.saveState]);

  useInput((input, key) => {
    if (state.edit) {
      if (key.escape) dispatch({ type: 'CANCEL_EDIT' });
      // TextInput handles all other keys in edit mode.
      return;
    }

    if (key.escape)      { onClose(); return; }
    if (input === 'k' || key.upArrow)   dispatch({ type: 'CURSOR_UP' });
    else if (input === 'j' || key.downArrow) dispatch({ type: 'CURSOR_DOWN' });
    else if (key.return) dispatch({ type: 'BEGIN_EDIT' });
    else if (input === 'd') dispatch({ type: 'DELETE_FIELD' });
    else if (input === 's') {
      if (saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      dispatch({ type: 'SAVE_START' });
      saveConfig(state.working).then(
        () => {
          saveInFlightRef.current = false;
          dispatch({ type: 'SAVE_SUCCESS' });
        },
        (err) => {
          saveInFlightRef.current = false;
          dispatch({ type: 'SAVE_FAIL', error: err.message });
        },
      );
    }
  });

  const editingFieldKey = state.edit?.fieldKey ?? null;

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'gray', paddingY: 1 },
    // Title
    h(Box, { paddingX: 2 }, h(Text, { bold: true, color: 'cyan' }, '─ Settings')),
    h(Box, { paddingX: 2 },
      h(Text, { dimColor: true }, '  ' + 'Field'.padEnd(18) + 'Value'.padEnd(28) + 'Source'),
    ),
    h(Box, { paddingX: 2 }, h(Text, { dimColor: true }, '  ' + '─'.repeat(58))),

    // Field grid
    ...FIELDS.map((field) => {
      const isCursor = FIELDS[state.cursor]?.key === field.key;
      const value  = getField(state.working, field.key);
      const source = sourceLabel(resolved, field.key, state.working, state.baseline);

      if (isCursor && editingFieldKey === field.key) {
        return h(EditRowInline, {
          key: field.key,
          field,
          draft: state.edit.draft,
          dispatch,
        });
      }

      return h(FieldRow, { key: field.key, field, isCursor, value, source });
    }),

    h(Box, null), // spacer
    h(StatusLine, { saveState: state.saveState }),
    h(Box, { paddingX: 2 },
      h(Text, { dimColor: true }, '  [enter] edit  [d] delete (revert)  [s] save  [esc] back'),
    ),
  );
}
