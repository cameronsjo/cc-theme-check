// Tests for src/forge/catalog.mjs — the flatten() function that produces
// the cursor-index list driving TokenList navigation.
//
// Test Plan:
//   flatten (data transformer)
//     [x] Happy: with no collapsed/filter, returns all tokens
//     [x] Behavioral: each token carries section name
//     [x] Behavioral: collapsed section excluded
//     [x] Behavioral: filter matches token key (case-insensitive)
//     [x] Behavioral: filter matches token label (case-insensitive)
//     [x] Behavioral: filter that matches nothing returns empty list
//     [x] Behavioral: type:'bg' tokens pass through unchanged
//     [x] Boundary: empty filter string is treated as no filter

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, flatten } from '../src/forge/catalog.mjs';

describe('CATALOG structure', () => {
  test('every section has section name and tokens array', () => {
    for (const s of CATALOG) {
      assert.equal(typeof s.section, 'string');
      assert.ok(Array.isArray(s.tokens));
      assert.ok(s.tokens.length > 0);
    }
  });

  test('every token has key and label', () => {
    for (const s of CATALOG) {
      for (const t of s.tokens) {
        assert.equal(typeof t.key, 'string');
        assert.equal(typeof t.label, 'string');
      }
    }
  });

  test('Diff View tokens are all marked type:bg', () => {
    const diff = CATALOG.find(s => s.section === 'Diff View');
    assert.ok(diff);
    for (const t of diff.tokens) {
      assert.equal(t.type, 'bg', `expected ${t.key} to be type bg`);
    }
  });
});

describe('flatten()', () => {
  test('with no collapse/filter, returns every token in catalog', () => {
    const out = flatten(CATALOG);
    const total = CATALOG.reduce((acc, s) => acc + s.tokens.length, 0);
    assert.equal(out.length, total);
  });

  test('each output token carries its section name', () => {
    const out = flatten(CATALOG);
    const first = out[0];
    assert.equal(first.section, CATALOG[0].section);
    assert.equal(first.key, CATALOG[0].tokens[0].key);
  });

  test('collapsed section is excluded', () => {
    const collapsed = new Set(['Rainbow', 'Rainbow Shimmer']);
    const out = flatten(CATALOG, collapsed);
    assert.equal(out.find(t => t.section === 'Rainbow'), undefined);
    assert.equal(out.find(t => t.section === 'Rainbow Shimmer'), undefined);
    // Other sections still present
    assert.ok(out.find(t => t.section === 'Prompt Borders'));
  });

  test('filter matches token key (case-insensitive)', () => {
    const out = flatten(CATALOG, new Set(), 'RAINBOW');
    assert.ok(out.length > 0);
    for (const t of out) {
      const matches = t.key.toLowerCase().includes('rainbow') ||
                      t.label.toLowerCase().includes('rainbow');
      assert.ok(matches, `${t.key}/${t.label} should match 'rainbow'`);
    }
  });

  test('filter matches token label (case-insensitive)', () => {
    // 'border' appears in labels (e.g. "default input border") but not all keys
    const out = flatten(CATALOG, new Set(), 'border');
    assert.ok(out.length > 0);
    for (const t of out) {
      const matches = t.key.toLowerCase().includes('border') ||
                      t.label.toLowerCase().includes('border');
      assert.ok(matches);
    }
  });

  test('filter with no matches returns empty array', () => {
    const out = flatten(CATALOG, new Set(), 'definitely-not-a-token-zzz');
    assert.deepEqual(out, []);
  });

  test('empty filter string is treated as no filter', () => {
    const full = flatten(CATALOG);
    const out = flatten(CATALOG, new Set(), '');
    assert.equal(out.length, full.length);
  });

  test('type:bg tokens pass through with type preserved', () => {
    const out = flatten(CATALOG);
    const diffAdded = out.find(t => t.key === 'diffAdded');
    assert.ok(diffAdded);
    assert.equal(diffAdded.type, 'bg');
  });

  test('non-bg tokens do not have a type field', () => {
    const out = flatten(CATALOG);
    const text = out.find(t => t.key === 'text');
    assert.ok(text);
    assert.equal(text.type, undefined);
  });
});
