// Tests for src/forge/state.mjs — the reducer that drives the TUI.
//
// Test Plan:
//   initialState (configuration)
//     [x] Happy: returns shape with all fields initialized
//     [x] Behavioral: overrides is cloned (not shared with caller)
//   reducer (state machine)
//     CURSOR_DOWN/UP
//       [x] Happy: increments/decrements cursor
//       [x] Boundary: cursor clamps to 0 and (length - 1)
//     TOGGLE_SECTION
//       [x] Behavioral: collapse -> expand round-trips; cursor resets to 0
//     BEGIN_EDIT / EDIT_INPUT / COMMIT_EDIT / CANCEL_EDIT
//       [x] Happy: full edit lifecycle commits valid hex
//       [x] Unhappy: invalid hex sets status, keeps edit open... actually no — commits returns to non-edit state with error status
//       [x] Behavioral: empty draft hex deletes the override
//       [x] Behavioral: CANCEL_EDIT clears edit without writing
//     UNDO/REDO
//       [x] Behavioral: undo restores prior overrides; redo re-applies
//       [x] Boundary: undo with empty history sets status, doesn't crash
//       [x] Boundary: HISTORY_CAP=100 — 101 edits drop the oldest
//     SAVE_SUCCESS
//       [x] Behavioral: baselines against snapshot, not state.overrides
//       [x] Behavioral: clears quitConfirm
//     SAVE_FAIL
//       [x] Behavioral: surfaces error in status
//     QUIT_CONFIRM
//       [x] Behavioral: sets quitConfirm + warning status
//     SET_FILTER / CLEAR_FILTER
//       [x] Happy: filter narrows visibleTokens; cursor resets to 0
//   isDirty (pure logic)
//     [x] Happy: identical baseline/overrides -> false
//     [x] Unhappy: differing overrides -> true

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  visibleTokens,
  focusedToken,
  isDirty,
  reducer,
} from '../src/forge/state.mjs';

function makeState(overrides = {}) {
  return initialState({
    overrides,
    canvasBg: '#000000',
    themePath: '/tmp/test-theme.json',
    ghosttyTheme: null,
    themeRaw: { name: 'Test', base: 'dark-ansi', overrides },
  });
}

describe('initialState', () => {
  test('returns a fully-initialized shape', () => {
    const s = makeState({ text: '#ffffff' });
    assert.equal(s.cursor, 0);
    assert.deepEqual(s.overrides, { text: '#ffffff' });
    assert.deepEqual(s.baseline, { text: '#ffffff' });
    assert.equal(s.canvasBg, '#000000');
    assert.equal(s.edit, null);
    assert.deepEqual(s.history, []);
    assert.deepEqual(s.redoStack, []);
    assert.equal(s.filter, '');
    assert.equal(s.status, '');
    assert.equal(s.quitConfirm, false);
    assert.ok(s.collapsed instanceof Set);
  });

  test('overrides is cloned (mutating caller object does not affect state)', () => {
    const o = { text: '#ffffff' };
    const s = makeState(o);
    o.text = '#000000';
    assert.equal(s.overrides.text, '#ffffff');
  });
});

describe('reducer: CURSOR_DOWN/UP', () => {
  test('CURSOR_DOWN increments cursor', () => {
    const s = reducer(makeState(), { type: 'CURSOR_DOWN' });
    assert.equal(s.cursor, 1);
  });

  test('CURSOR_UP decrements cursor', () => {
    const s0 = { ...makeState(), cursor: 3 };
    const s = reducer(s0, { type: 'CURSOR_UP' });
    assert.equal(s.cursor, 2);
  });

  test('CURSOR_UP clamps at 0 (does not go negative)', () => {
    const s = reducer(makeState(), { type: 'CURSOR_UP' });
    assert.equal(s.cursor, 0);
  });

  test('CURSOR_DOWN clamps at list length - 1', () => {
    const s0 = makeState();
    const max = visibleTokens(s0).length - 1;
    const overshot = { ...s0, cursor: max };
    const s = reducer(overshot, { type: 'CURSOR_DOWN' });
    assert.equal(s.cursor, max);
  });
});

describe('reducer: TOGGLE_SECTION', () => {
  test('first toggle collapses section', () => {
    const s = reducer(makeState(), { type: 'TOGGLE_SECTION', section: 'Prompt Borders' });
    assert.ok(s.collapsed.has('Prompt Borders'));
  });

  test('second toggle expands section', () => {
    const s1 = reducer(makeState(), { type: 'TOGGLE_SECTION', section: 'Prompt Borders' });
    const s2 = reducer(s1, { type: 'TOGGLE_SECTION', section: 'Prompt Borders' });
    assert.equal(s2.collapsed.has('Prompt Borders'), false);
  });

  test('toggle resets cursor to 0', () => {
    const s0 = { ...makeState(), cursor: 5 };
    const s = reducer(s0, { type: 'TOGGLE_SECTION', section: 'Prompt Borders' });
    assert.equal(s.cursor, 0);
  });
});

describe('reducer: BEGIN_EDIT / EDIT_INPUT / COMMIT_EDIT', () => {
  test('BEGIN_EDIT enters edit mode with current override as draft', () => {
    const s0 = makeState({ promptBorder: '#aabbcc' });
    const s = reducer(s0, { type: 'BEGIN_EDIT' });
    assert.ok(s.edit);
    assert.equal(s.edit.draftHex, '#aabbcc');
  });

  test('BEGIN_EDIT with no existing override starts with empty draft', () => {
    const s0 = makeState();
    const s = reducer(s0, { type: 'BEGIN_EDIT' });
    assert.equal(s.edit.draftHex, '');
  });

  test('EDIT_INPUT updates draftHex', () => {
    const s1 = reducer(makeState(), { type: 'BEGIN_EDIT' });
    const s2 = reducer(s1, { type: 'EDIT_INPUT', value: '#ff0000' });
    assert.equal(s2.edit.draftHex, '#ff0000');
  });

  test('COMMIT_EDIT with valid hex applies override and clears edit', () => {
    const s1 = reducer(makeState(), { type: 'BEGIN_EDIT' });
    const focused = focusedToken(s1);
    const s2 = reducer(s1, { type: 'EDIT_INPUT', value: '#ff0000' });
    const s3 = reducer(s2, { type: 'COMMIT_EDIT' });
    assert.equal(s3.edit, null);
    assert.equal(s3.overrides[focused.key], '#ff0000');
  });

  test('COMMIT_EDIT with empty hex deletes the override', () => {
    const s0 = makeState({ promptBorder: '#aabbcc' });
    // Force cursor onto promptBorder (it's first token in catalog)
    const s1 = reducer(s0, { type: 'BEGIN_EDIT' });
    const focused = focusedToken(s1);
    const s2 = reducer(s1, { type: 'EDIT_INPUT', value: '' });
    const s3 = reducer(s2, { type: 'COMMIT_EDIT' });
    assert.equal(s3.overrides[focused.key], undefined);
  });

  test('COMMIT_EDIT with invalid hex sets status, stays in edit mode', () => {
    const s1 = reducer(makeState(), { type: 'BEGIN_EDIT' });
    const s2 = reducer(s1, { type: 'EDIT_INPUT', value: '#zz' });
    const s3 = reducer(s2, { type: 'COMMIT_EDIT' });
    assert.match(s3.status, /invalid hex/);
    // edit remains open so user can correct without re-pressing enter
    assert.ok(s3.edit);
  });

  test('CANCEL_EDIT clears edit without committing', () => {
    const s1 = reducer(makeState(), { type: 'BEGIN_EDIT' });
    const s2 = reducer(s1, { type: 'EDIT_INPUT', value: '#ff0000' });
    const s3 = reducer(s2, { type: 'CANCEL_EDIT' });
    assert.equal(s3.edit, null);
    // Override should NOT have been written
    const focused = focusedToken(s1);
    assert.equal(s3.overrides[focused.key], undefined);
  });
});

describe('reducer: UNDO/REDO', () => {
  test('UNDO with empty history sets status, does not crash', () => {
    const s = reducer(makeState(), { type: 'UNDO' });
    assert.match(s.status, /nothing to undo/);
  });

  test('UNDO restores prior overrides after a commit', () => {
    const s1 = reducer(makeState(), { type: 'BEGIN_EDIT' });
    const s2 = reducer(s1, { type: 'EDIT_INPUT', value: '#ff0000' });
    const s3 = reducer(s2, { type: 'COMMIT_EDIT' });
    const focused = focusedToken(s3);
    assert.equal(s3.overrides[focused.key], '#ff0000');
    const s4 = reducer(s3, { type: 'UNDO' });
    assert.equal(s4.overrides[focused.key], undefined);
  });

  test('REDO re-applies an undone change', () => {
    const s1 = reducer(makeState(), { type: 'BEGIN_EDIT' });
    const s2 = reducer(s1, { type: 'EDIT_INPUT', value: '#ff0000' });
    const s3 = reducer(s2, { type: 'COMMIT_EDIT' });
    const s4 = reducer(s3, { type: 'UNDO' });
    const s5 = reducer(s4, { type: 'REDO' });
    const focused = focusedToken(s3);
    assert.equal(s5.overrides[focused.key], '#ff0000');
  });

  test('history is capped at 100 entries (oldest dropped)', () => {
    let s = makeState();
    // 101 commits — each commit pushes prior overrides onto history.
    for (let i = 0; i < 101; i++) {
      s = reducer(s, { type: 'BEGIN_EDIT' });
      const hex = `#${i.toString(16).padStart(2, '0')}0000`;
      s = reducer(s, { type: 'EDIT_INPUT', value: hex });
      s = reducer(s, { type: 'COMMIT_EDIT' });
    }
    assert.equal(s.history.length, 100, 'history should cap at 100');
  });
});

describe('reducer: SAVE_SUCCESS / SAVE_FAIL', () => {
  test('SAVE_SUCCESS baselines against snapshot (not current overrides)', () => {
    // Simulate: user edited promptBorder to red, save in flight, user then
    // edits it to blue, then SAVE_SUCCESS arrives carrying the red snapshot.
    // baseline should be red — blue stays dirty.
    const s0 = makeState();
    const snapshot = { promptBorder: '#ff0000' };
    const current = { promptBorder: '#0000ff' };
    const s1 = { ...s0, overrides: current };
    const s2 = reducer(s1, { type: 'SAVE_SUCCESS', snapshot });
    assert.deepEqual(s2.baseline, snapshot);
    assert.deepEqual(s2.overrides, current);
    assert.ok(isDirty(s2), 'state should be dirty — saved was the older snapshot');
    assert.equal(s2.status, 'saved');
  });

  test('SAVE_SUCCESS clears quitConfirm', () => {
    const s0 = { ...makeState(), quitConfirm: true };
    const s = reducer(s0, { type: 'SAVE_SUCCESS', snapshot: {} });
    assert.equal(s.quitConfirm, false);
  });

  test('SAVE_FAIL surfaces error message in status', () => {
    const s = reducer(makeState(), { type: 'SAVE_FAIL', error: 'EACCES' });
    assert.match(s.status, /save failed.*EACCES/);
  });
});

describe('reducer: QUIT_CONFIRM', () => {
  test('sets quitConfirm and warning status', () => {
    const s = reducer(makeState(), { type: 'QUIT_CONFIRM' });
    assert.equal(s.quitConfirm, true);
    assert.match(s.status, /unsaved changes/);
  });
});

describe('reducer: SET_FILTER / CLEAR_FILTER', () => {
  test('SET_FILTER narrows visibleTokens', () => {
    const s0 = makeState();
    const before = visibleTokens(s0).length;
    const s = reducer(s0, { type: 'SET_FILTER', value: 'rainbow' });
    const after = visibleTokens(s).length;
    assert.ok(after > 0);
    assert.ok(after < before, 'filter should narrow the list');
  });

  test('SET_FILTER resets cursor to 0', () => {
    const s0 = { ...makeState(), cursor: 10 };
    const s = reducer(s0, { type: 'SET_FILTER', value: 'rainbow' });
    assert.equal(s.cursor, 0);
  });

  test('CLEAR_FILTER restores full list', () => {
    const s0 = makeState();
    const full = visibleTokens(s0).length;
    const s1 = reducer(s0, { type: 'SET_FILTER', value: 'rainbow' });
    const s2 = reducer(s1, { type: 'CLEAR_FILTER' });
    assert.equal(visibleTokens(s2).length, full);
    assert.equal(s2.filter, '');
  });
});

describe('isDirty', () => {
  test('returns false when overrides match baseline', () => {
    assert.equal(isDirty(makeState({ text: '#fff' })), false);
  });

  test('returns true when overrides differ from baseline', () => {
    const s0 = makeState({ text: '#ffffff' });
    const s1 = { ...s0, overrides: { text: '#000000' } };
    assert.equal(isDirty(s1), true);
  });

  test('returns true when a new key is added', () => {
    const s0 = makeState();
    const s1 = { ...s0, overrides: { promptBorder: '#abc123' } };
    assert.equal(isDirty(s1), true);
  });
});

describe('reducer: unknown action', () => {
  test('returns state unchanged', () => {
    const s0 = makeState();
    const s1 = reducer(s0, { type: 'NOT_A_REAL_ACTION' });
    assert.equal(s1, s0);
  });
});
