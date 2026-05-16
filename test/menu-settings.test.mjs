// Tests for the Settings pane's reducer + helpers in
// src/menu/components/Settings.mjs — the state machine that drives
// the launcher's settings editor.
//
// Test Plan:
//   getField / setField / deleteField (path helpers)
//     [x] Happy: nested `defaultFlags.audit` round-trips
//     [x] Happy: flat key `bgOverride` round-trips
//     [x] Behavioral: getField returns sentinel ('' or false) when missing
//     [x] Behavioral: deleteField removes the key entirely (not just nulls it)
//     [x] Boundary: deleting a missing field is a no-op (doesn't add it)
//   sourceLabel (mapping flat sources to nested fieldKeys)
//     [x] Behavioral: defaultFlags.audit → looks up sources.audit
//     [x] Behavioral: ghosttyTheme → looks up sources.ghosttyPath
//     [x] Behavioral: dirty working state returns 'settings*' regardless of source
//     [x] Boundary: missing source falls back to 'default'
//   reducer (state machine)
//     CURSOR_UP / CURSOR_DOWN
//       [x] Happy: increments / decrements cursor
//       [x] Boundary: clamps at 0 and FIELDS.length - 1
//     BEGIN_EDIT
//       [x] Happy: opens edit on string field with current value as draft
//       [x] Behavioral: boolean field toggles immediately (no edit mode)
//     UPDATE_DRAFT / COMMIT_EDIT
//       [x] Happy: updates draft, commits to working
//       [x] Behavioral: empty draft deletes the field
//     CANCEL_EDIT
//       [x] Behavioral: clears edit without writing
//     DELETE_FIELD
//       [x] Behavioral: removes the field from working
//     SAVE_START / SAVE_SUCCESS / SAVE_FAIL / CLEAR_STATUS
//       [x] Behavioral: SAVE_SUCCESS baselines against working (so dirty resets)
//       [x] Behavioral: SAVE_FAIL surfaces error

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELDS,
  getField,
  setField,
  deleteField,
  sourceLabel,
  initialState,
  reducer,
} from '../src/menu/components/Settings.mjs';

// ─── path helpers ─────────────────────────────────────────────────────────────

describe('getField / setField / deleteField', () => {
  test('nested defaultFlags round-trips', () => {
    const s = setField({}, 'defaultFlags.audit', true);
    assert.equal(s.defaultFlags.audit, true);
    assert.equal(getField(s, 'defaultFlags.audit'), true);
  });

  test('flat key round-trips', () => {
    const s = setField({}, 'bgOverride', '#ff00ff');
    assert.equal(s.bgOverride, '#ff00ff');
    assert.equal(getField(s, 'bgOverride'), '#ff00ff');
  });

  test('getField returns sentinel for missing flat key', () => {
    assert.equal(getField({}, 'bgOverride'), '');
  });

  test('getField returns false for missing boolean', () => {
    assert.equal(getField({}, 'defaultFlags.audit'), false);
  });

  test('deleteField removes flat key entirely', () => {
    const s = deleteField({ bgOverride: '#000' }, 'bgOverride');
    assert.equal('bgOverride' in s, false);
  });

  test('deleteField removes nested key without dropping siblings', () => {
    const s = deleteField(
      { defaultFlags: { audit: true, palette: true } },
      'defaultFlags.audit',
    );
    assert.equal('audit' in s.defaultFlags, false);
    assert.equal(s.defaultFlags.palette, true);
  });

  test('deleteField on missing key is a no-op', () => {
    const s = deleteField({}, 'bgOverride');
    assert.deepEqual(s, {});
  });
});

// ─── sourceLabel ──────────────────────────────────────────────────────────────

describe('sourceLabel', () => {
  test('defaultFlags.audit looks up sources.audit', () => {
    const resolved = { sources: { audit: 'flag' } };
    const label = sourceLabel(resolved, 'defaultFlags.audit', {}, {});
    assert.equal(label, 'flag');
  });

  test('ghosttyTheme looks up sources.ghosttyPath', () => {
    const resolved = { sources: { ghosttyPath: 'autodetect' } };
    const label = sourceLabel(resolved, 'ghosttyTheme', {}, {});
    assert.equal(label, 'autodetect');
  });

  test('dirty working state returns settings* regardless of source', () => {
    const resolved = { sources: { bgOverride: 'autodetect' } };
    const label = sourceLabel(
      resolved,
      'bgOverride',
      { bgOverride: '#abc' },    // working
      { bgOverride: '#def' },    // baseline
    );
    assert.equal(label, 'settings*');
  });

  test('missing source falls back to default', () => {
    const label = sourceLabel({ sources: {} }, 'bgOverride', {}, {});
    assert.equal(label, 'default');
  });

  test('null resolved is safe', () => {
    const label = sourceLabel(null, 'bgOverride', {}, {});
    assert.equal(label, 'default');
  });
});

// ─── reducer ──────────────────────────────────────────────────────────────────

function makeState() {
  return initialState({ settings: { defaultFlags: {} } });
}

describe('reducer — cursor', () => {
  test('CURSOR_DOWN increments', () => {
    const next = reducer(makeState(), { type: 'CURSOR_DOWN' });
    assert.equal(next.cursor, 1);
  });

  test('CURSOR_UP from 0 clamps at 0', () => {
    const next = reducer(makeState(), { type: 'CURSOR_UP' });
    assert.equal(next.cursor, 0);
  });

  test('CURSOR_DOWN clamps at FIELDS.length - 1', () => {
    let s = makeState();
    for (let i = 0; i < FIELDS.length + 5; i++) s = reducer(s, { type: 'CURSOR_DOWN' });
    assert.equal(s.cursor, FIELDS.length - 1);
  });
});

describe('reducer — edit lifecycle', () => {
  test('BEGIN_EDIT on string field opens edit with current value', () => {
    const start = { ...makeState(), cursor: 0, working: { ghosttyTheme: 'artificer-dark' } };
    const next = reducer(start, { type: 'BEGIN_EDIT' });
    assert.deepEqual(next.edit, { fieldKey: 'ghosttyTheme', draft: 'artificer-dark' });
  });

  test('BEGIN_EDIT on boolean field toggles immediately', () => {
    // Find a boolean field's cursor index
    const idx = FIELDS.findIndex((f) => f.type === 'boolean');
    const start = { ...makeState(), cursor: idx };
    const next = reducer(start, { type: 'BEGIN_EDIT' });
    assert.equal(next.edit, null);                       // no edit mode
    assert.equal(getField(next.working, FIELDS[idx].key), true);
  });

  test('UPDATE_DRAFT updates the draft string', () => {
    const start = { ...makeState(), edit: { fieldKey: 'ghosttyTheme', draft: '' } };
    const next = reducer(start, { type: 'UPDATE_DRAFT', value: 'ocean-dark' });
    assert.equal(next.edit.draft, 'ocean-dark');
  });

  test('COMMIT_EDIT writes draft to working, clears edit', () => {
    const start = { ...makeState(), edit: { fieldKey: 'ghosttyTheme', draft: 'ocean-dark' } };
    const next = reducer(start, { type: 'COMMIT_EDIT' });
    assert.equal(next.edit, null);
    assert.equal(getField(next.working, 'ghosttyTheme'), 'ocean-dark');
  });

  test('COMMIT_EDIT with empty draft deletes the field', () => {
    const start = {
      ...makeState(),
      working: { ghosttyTheme: 'ocean-dark' },
      edit: { fieldKey: 'ghosttyTheme', draft: '' },
    };
    const next = reducer(start, { type: 'COMMIT_EDIT' });
    assert.equal('ghosttyTheme' in next.working, false);
  });

  test('CANCEL_EDIT clears edit without writing', () => {
    const start = {
      ...makeState(),
      working: { ghosttyTheme: 'artificer-dark' },
      edit: { fieldKey: 'ghosttyTheme', draft: 'unrelated-typing' },
    };
    const next = reducer(start, { type: 'CANCEL_EDIT' });
    assert.equal(next.edit, null);
    assert.equal(getField(next.working, 'ghosttyTheme'), 'artificer-dark');
  });
});

describe('reducer — delete', () => {
  test('DELETE_FIELD removes the focused field from working', () => {
    const start = {
      ...makeState(),
      cursor: 0,
      working: { ghosttyTheme: 'artificer-dark' },
    };
    const next = reducer(start, { type: 'DELETE_FIELD' });
    assert.equal('ghosttyTheme' in next.working, false);
  });
});

describe('reducer — save lifecycle', () => {
  test('SAVE_START sets saveState to "saving"', () => {
    const next = reducer(makeState(), { type: 'SAVE_START' });
    assert.equal(next.saveState, 'saving');
  });

  test('SAVE_SUCCESS baselines against working (so dirty resets)', () => {
    const start = {
      ...makeState(),
      working: { bgOverride: '#abc' },
      baseline: {},
    };
    const next = reducer(start, { type: 'SAVE_SUCCESS' });
    assert.deepEqual(next.baseline, { bgOverride: '#abc' });
    assert.deepEqual(next.saveState, { ok: true });
  });

  test('SAVE_SUCCESS prefers action.snapshot over working (mid-save edits stay dirty)', () => {
    // Simulates: user pressed `s`, snapshot captured as {bgOverride:'#abc'},
    // user typed another edit before saveConfig resolved → working is now
    // {bgOverride:'#abc', ghosttyTheme:'mid-save'}. Baseline must match what
    // was written (snapshot), not the post-edit working state.
    const start = {
      ...makeState(),
      working: { bgOverride: '#abc', ghosttyTheme: 'mid-save' },
      baseline: {},
    };
    const next = reducer(start, {
      type: 'SAVE_SUCCESS',
      snapshot: { bgOverride: '#abc' },
    });
    assert.deepEqual(next.baseline, { bgOverride: '#abc' });
    // The mid-save edit remains in working → dirty indicator still fires.
    assert.equal(next.working.ghosttyTheme, 'mid-save');
  });

  test('SAVE_FAIL surfaces error', () => {
    const next = reducer(makeState(), { type: 'SAVE_FAIL', error: 'EACCES' });
    assert.deepEqual(next.saveState, { ok: false, error: 'EACCES' });
  });

  test('CLEAR_STATUS resets saveState to null', () => {
    const start = { ...makeState(), saveState: { ok: true } };
    const next = reducer(start, { type: 'CLEAR_STATUS' });
    assert.equal(next.saveState, null);
  });
});
