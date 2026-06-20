// Tests for src/ini.mjs — minimal INI line parser shared by Ghostty config
// and theme files. Pure-logic, boundary-critical: a regression here breaks
// both autodetect and the theme-file loader silently.
//
// Test Plan:
//   parseIniLine (pure logic)
//     [x] Happy: `key = value` (spaces around =)
//     [x] Happy: `key=value` (no spaces) — the behavior change we just landed
//     [x] Happy: `key  =  value` (extra spaces around =)
//     [x] Happy: leading/trailing whitespace on the whole line is trimmed
//     [x] Happy: `palette = 0=#1a1d2e` — splits on FIRST `=`, value keeps inner `=`
//     [x] Skips: blank line returns null
//     [x] Skips: whitespace-only line returns null
//     [x] Skips: `# comment` returns null
//     [x] Skips: `   # indented comment` returns null
//     [x] Skips: no `=` at all returns null
//     [x] Boundary: empty value (`key = `) returns key with empty string value
//     [x] Boundary: empty key (`= value`) returns empty-string key + value
//                   (caller decides what to do with it — we don't reject)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseIniLine } from '../src/ini.mjs';

describe('parseIniLine', () => {
  test('key = value (spaces around =)', () => {
    assert.deepEqual(parseIniLine('theme = artificer-dark'), {
      key: 'theme',
      value: 'artificer-dark',
    });
  });

  test('key=value (no spaces around =)', () => {
    assert.deepEqual(parseIniLine('theme=artificer-dark'), {
      key: 'theme',
      value: 'artificer-dark',
    });
  });

  test('key  =  value (extra spaces around =)', () => {
    assert.deepEqual(parseIniLine('theme   =   artificer-dark'), {
      key: 'theme',
      value: 'artificer-dark',
    });
  });

  test('leading/trailing whitespace on the line is trimmed', () => {
    assert.deepEqual(parseIniLine('  theme = artificer-dark  '), {
      key: 'theme',
      value: 'artificer-dark',
    });
  });

  test('palette = 0=#1a1d2e — splits on FIRST = only', () => {
    // Critical: Ghostty theme files use `palette = N=#hex` syntax. Splitting
    // on every `=` would break this.
    assert.deepEqual(parseIniLine('palette = 0=#1a1d2e'), {
      key: 'palette',
      value: '0=#1a1d2e',
    });
  });

  test('palette without spaces = 0=#1a1d2e', () => {
    assert.deepEqual(parseIniLine('palette=0=#1a1d2e'), {
      key: 'palette',
      value: '0=#1a1d2e',
    });
  });

  test('blank line returns null', () => {
    assert.equal(parseIniLine(''), null);
  });

  test('whitespace-only line returns null', () => {
    assert.equal(parseIniLine('   \t  '), null);
  });

  test('# comment returns null', () => {
    assert.equal(parseIniLine('# this is a comment'), null);
  });

  test('indented # comment returns null', () => {
    assert.equal(parseIniLine('   # indented comment'), null);
  });

  test('line without = returns null', () => {
    assert.equal(parseIniLine('just some text'), null);
  });

  test('empty value (key = ) returns empty-string value', () => {
    assert.deepEqual(parseIniLine('theme = '), {
      key: 'theme',
      value: '',
    });
  });

  test('empty key (= value) returns empty-string key', () => {
    // The parser is permissive — the caller decides whether empty keys are
    // meaningful. Both autodetect and ghostty.mjs filter on specific key
    // names so an empty key is harmless.
    assert.deepEqual(parseIniLine('= value'), {
      key: '',
      value: 'value',
    });
  });

  test('value containing # (not a comment, just the value)', () => {
    // The # check is line-leading-only; a # inside a value is preserved.
    assert.deepEqual(parseIniLine('background = #1a1d2e'), {
      key: 'background',
      value: '#1a1d2e',
    });
  });
});
