// Tests for src/init.mjs exported helpers — slug validation and title case.
// The interactive prompter is tested separately via stdin piping; here we
// just verify the pure-function building blocks.
//
// Test Plan:
//   SLUG_RE (input validator — strict kebab-case)
//     [x] Happy: accepts standard kebab-case slugs
//     [x] Unhappy: rejects UPPERCASE
//     [x] Unhappy: rejects leading digit
//     [x] Unhappy: rejects leading hyphen
//     [x] Unhappy: rejects trailing hyphen
//     [x] Unhappy: rejects consecutive hyphens
//     [x] Unhappy: rejects underscores, spaces, special chars
//     [x] Boundary: single letter is valid
//     [x] Boundary: empty string is rejected
//   titleCase (data transformer)
//     [x] Happy: hyphen-separated -> Title Case
//     [x] Boundary: single word
//     [x] Boundary: empty string

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SLUG_RE, titleCase } from '../src/init.mjs';

describe('SLUG_RE', () => {
  test('accepts standard kebab-case slugs', () => {
    assert.ok(SLUG_RE.test('ocean-dark'));
    assert.ok(SLUG_RE.test('my-theme'));
    assert.ok(SLUG_RE.test('artificer'));
    assert.ok(SLUG_RE.test('three-word-name'));
  });

  test('accepts slugs with digits (not leading)', () => {
    assert.ok(SLUG_RE.test('theme1'));
    assert.ok(SLUG_RE.test('theme-2'));
    assert.ok(SLUG_RE.test('v2-dark'));
  });

  test('rejects UPPERCASE letters', () => {
    assert.equal(SLUG_RE.test('Ocean'), false);
    assert.equal(SLUG_RE.test('ocean-Dark'), false);
    assert.equal(SLUG_RE.test('OCEAN'), false);
  });

  test('rejects leading digit', () => {
    assert.equal(SLUG_RE.test('1-theme'), false);
    assert.equal(SLUG_RE.test('2dark'), false);
  });

  test('rejects leading hyphen', () => {
    assert.equal(SLUG_RE.test('-theme'), false);
  });

  test('rejects trailing hyphen', () => {
    assert.equal(SLUG_RE.test('theme-'), false);
  });

  test('rejects consecutive hyphens', () => {
    assert.equal(SLUG_RE.test('theme--dark'), false);
    assert.equal(SLUG_RE.test('a--b'), false);
  });

  test('rejects underscores, spaces, dots, slashes', () => {
    assert.equal(SLUG_RE.test('theme_dark'), false);
    assert.equal(SLUG_RE.test('theme dark'), false);
    assert.equal(SLUG_RE.test('theme.dark'), false);
    assert.equal(SLUG_RE.test('theme/dark'), false);
  });

  test('single letter is valid', () => {
    assert.ok(SLUG_RE.test('a'));
  });

  test('empty string is rejected', () => {
    assert.equal(SLUG_RE.test(''), false);
  });
});

describe('titleCase', () => {
  test('converts hyphen-separated kebab-case to Title Case', () => {
    assert.equal(titleCase('ocean-dark'), 'Ocean Dark');
    assert.equal(titleCase('three-word-name'), 'Three Word Name');
  });

  test('handles single word', () => {
    assert.equal(titleCase('artificer'), 'Artificer');
  });

  test('handles word with digits', () => {
    assert.equal(titleCase('v2-dark'), 'V2 Dark');
  });

  test('empty string returns empty string', () => {
    assert.equal(titleCase(''), '');
  });
});
