// Tests for src/render/layout.mjs — ANSI stripping, padding, and platform glyphs.
//
// Test Plan:
//   stripAnsi (data transformer)
//     [x] Happy: strips standard color escape sequences
//     [x] Happy: strips reset/bold/dim codes
//     [x] Behavioral: leaves plain text untouched
//     [x] Boundary: empty string returns empty string
//   pad (data transformer)
//     [x] Happy: pads short string to target length
//     [x] Behavioral: counts visible chars only (ANSI-aware)
//     [x] Boundary: longer string than target returns unchanged
//   glyphs (platform-dependent configuration)
//     [x] Behavioral: returns expected keys
//     [x] Behavioral: toolDot is platform-dependent (⏺ on darwin, ● elsewhere)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi, pad, glyphs, WIDTH } from '../src/render/layout.mjs';

describe('stripAnsi', () => {
  test('strips simple color escape', () => {
    assert.equal(stripAnsi('\x1b[31mred\x1b[0m'), 'red');
  });

  test('strips bold + dim + color combinations', () => {
    assert.equal(stripAnsi('\x1b[1;2;38;5;208mbold-dim-orange\x1b[0m'), 'bold-dim-orange');
  });

  test('leaves plain text untouched', () => {
    assert.equal(stripAnsi('no escapes here'), 'no escapes here');
  });

  test('handles empty string', () => {
    assert.equal(stripAnsi(''), '');
  });

  test('strips multiple sequences in same string', () => {
    const ansi = '\x1b[31mred\x1b[0m and \x1b[32mgreen\x1b[0m';
    assert.equal(stripAnsi(ansi), 'red and green');
  });
});

describe('pad', () => {
  test('pads short string to target length', () => {
    assert.equal(pad('abc', 6), 'abc   ');
    assert.equal(pad('abc', 6).length, 6);
  });

  test('counts visible chars only (does not count ANSI in length)', () => {
    const ansi = '\x1b[31mabc\x1b[0m';
    const padded = pad(ansi, 6);
    // 'abc' visible -> needs 3 chars of padding
    assert.equal(stripAnsi(padded), 'abc   ');
  });

  test('longer-than-target string returns unchanged', () => {
    assert.equal(pad('abcdefgh', 4), 'abcdefgh');
  });

  test('exact-length string returns unchanged', () => {
    assert.equal(pad('abcd', 4), 'abcd');
  });

  test('uses custom pad char when given', () => {
    assert.equal(pad('a', 4, '·'), 'a···');
  });
});

describe('glyphs', () => {
  test('returns all expected keys', () => {
    const g = glyphs();
    assert.ok('toolDot' in g);
    assert.ok('connector' in g);
    assert.ok('thinkingDot' in g);
    assert.ok('youPrompt' in g);
    assert.ok('queuedDot' in g);
  });

  test('connector is U+23BB regardless of platform', () => {
    assert.equal(glyphs().connector, '⎿');
  });

  test('thinkingDot is ◆', () => {
    assert.equal(glyphs().thinkingDot, '◆');
  });

  test('toolDot matches current platform expectation', () => {
    const g = glyphs();
    const expected = process.platform === 'darwin' ? '⏺' : '●';
    assert.equal(g.toolDot, expected);
  });
});

describe('WIDTH constant', () => {
  test('is a positive integer', () => {
    assert.equal(typeof WIDTH, 'number');
    assert.ok(WIDTH > 0);
    assert.equal(Math.floor(WIDTH), WIDTH);
  });
});
