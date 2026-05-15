// Forge state lives in a reducer so every state transition is explicit
// and the undo stack can snapshot full state on edits. The catalog gives
// the structure; this module is purely about the working copy of overrides
// and cursor/edit/history concerns.
import { isValidHex } from '../contrast.mjs';
import { CATALOG, flatten } from './catalog.mjs';

const HISTORY_CAP = 100;

export function initialState({ overrides, canvasBg, themePath, ghosttyTheme, themeRaw }) {
  return {
    overrides: { ...overrides },
    baseline: { ...overrides },       // for dirty check + save
    canvasBg,
    themePath,
    ghosttyTheme,
    themeRaw,                          // full theme JSON for save round-trip
    cursor: 0,                         // index into flattened visible token list
    collapsed: new Set(),              // section names that are collapsed
    edit: null,                        // null or { tokenKey, draftHex }
    history: [],                       // undo stack of overrides snapshots
    redoStack: [],
    filter: '',
    status: '',                        // transient message (saved, error, etc.)
    quitConfirm: false,                // dirty + q pressed -> show prompt
  };
}

export function visibleTokens(state) {
  return flatten(CATALOG, state.collapsed, state.filter);
}

export function focusedToken(state) {
  const list = visibleTokens(state);
  return list[Math.min(state.cursor, list.length - 1)] ?? null;
}

export function isDirty(state) {
  return JSON.stringify(state.overrides) !== JSON.stringify(state.baseline);
}

export function reducer(state, action) {
  switch (action.type) {
    case 'CURSOR_DOWN': {
      const max = visibleTokens(state).length - 1;
      return { ...state, cursor: Math.min(state.cursor + 1, Math.max(0, max)), status: '' };
    }
    case 'CURSOR_UP':
      return { ...state, cursor: Math.max(state.cursor - 1, 0), status: '' };

    case 'TOGGLE_SECTION': {
      const next = new Set(state.collapsed);
      if (next.has(action.section)) next.delete(action.section);
      else next.add(action.section);
      return { ...state, collapsed: next, cursor: 0, status: '' };
    }

    case 'BEGIN_EDIT': {
      const tok = focusedToken(state);
      if (!tok) return state;
      return {
        ...state,
        edit: { tokenKey: tok.key, draftHex: state.overrides[tok.key] ?? '' },
        status: '',
      };
    }
    case 'EDIT_INPUT':
      if (!state.edit) return state;
      return { ...state, edit: { ...state.edit, draftHex: action.value } };
    case 'COMMIT_EDIT': {
      if (!state.edit) return state;
      const hex = state.edit.draftHex.trim();
      const next = { ...state.overrides };
      if (isValidHex(hex)) next[state.edit.tokenKey] = hex;
      else if (hex === '') delete next[state.edit.tokenKey];
      else return { ...state, status: `invalid hex: ${hex}` };
      return {
        ...state,
        overrides: next,
        edit: null,
        // Cap undo history at 100 entries — a long forge session shouldn't
        // accumulate unbounded snapshots.
        history: [...state.history, state.overrides].slice(-HISTORY_CAP),
        redoStack: [],
        status: '',
      };
    }
    case 'CANCEL_EDIT':
      return { ...state, edit: null, status: '' };

    case 'UNDO': {
      if (state.history.length === 0) return { ...state, status: 'nothing to undo' };
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        overrides: prev,
        history: state.history.slice(0, -1),
        redoStack: [...state.redoStack, state.overrides].slice(-HISTORY_CAP),
        status: 'undo',
      };
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return { ...state, status: 'nothing to redo' };
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        overrides: next,
        redoStack: state.redoStack.slice(0, -1),
        history: [...state.history, state.overrides].slice(-HISTORY_CAP),
        status: 'redo',
      };
    }

    case 'SAVE_SUCCESS':
      // baseline against the snapshot we actually wrote, not state.overrides,
      // so concurrent edits during the async writeFile don't get folded into
      // the clean baseline (which would silently mark them as "saved").
      return { ...state, baseline: { ...action.snapshot }, quitConfirm: false, status: 'saved' };
    case 'SAVE_FAIL':
      return { ...state, status: `save failed: ${action.error}` };

    case 'QUIT_CONFIRM':
      return { ...state, quitConfirm: true, status: 'unsaved changes — press q again to discard, s to save' };

    case 'SET_FILTER':
      return { ...state, filter: action.value, cursor: 0, status: '' };
    case 'CLEAR_FILTER':
      return { ...state, filter: '', cursor: 0, status: '' };

    default:
      return state;
  }
}
