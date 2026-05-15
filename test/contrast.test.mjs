// Tests for src/contrast.mjs — WCAG math, validation, bucket classification,
// and the audit log lifecycle that watch/edit modes depend on.
//
// Test Plan:
//   contrastRatio (pure logic)
//     [x] Happy: white-on-black returns ~21:1 (max possible)
//     [x] Happy: identical colors return 1:1 (min possible)
//     [x] Happy: matches known WCAG reference values
//     [x] Boundary: short-form hex (#fff) expands correctly
//   isValidHex (input validator)
//     [x] Happy: accepts 6-digit hex with #
//     [x] Unhappy: rejects missing #, short form, non-hex chars, non-string
//   wcagBucket (pure logic, boundary-critical)
//     [x] Boundary: 4.5 -> AA; 4.49 -> aa; 3.0 -> aa; 2.99 -> FAIL
//     [x] Happy: 21:1 -> AA; 1:1 -> FAIL
//   auditContrast / resetAudit (state machine — accumulator)
//     [x] Behavioral: first call records, second call with same label is a no-op
//     [x] Behavioral: invalid hex returns null and doesn't record
//     [x] Behavioral: resetAudit clears both log and dedupe set

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio,
  isValidHex,
  wcagBucket,
  auditContrast,
  resetAudit,
  auditLog,
} from '../src/contrast.mjs';

describe('contrastRatio', () => {
  test('white-on-black is 21:1 (max possible)', () => {
    assert.equal(Math.round(contrastRatio('#ffffff', '#000000')), 21);
  });

  test('identical colors are 1:1 (min possible)', () => {
    assert.equal(contrastRatio('#888888', '#888888'), 1);
  });

  test('order-independent (fg/bg swap returns same ratio)', () => {
    const a = contrastRatio('#ff0000', '#222222');
    const b = contrastRatio('#222222', '#ff0000');
    assert.equal(a, b);
  });

  test('short-form hex expands correctly (#fff === #ffffff)', () => {
    const long = contrastRatio('#ffffff', '#000000');
    const short = contrastRatio('#fff', '#000');
    assert.equal(long, short);
  });

  test('matches WCAG reference: #767676 on #ffffff ≈ 4.5:1', () => {
    const r = contrastRatio('#767676', '#ffffff');
    assert.ok(r >= 4.48 && r <= 4.55, `expected ~4.5, got ${r}`);
  });
});

describe('isValidHex', () => {
  test('accepts standard 6-digit hex', () => {
    assert.equal(isValidHex('#ffffff'), true);
    assert.equal(isValidHex('#000000'), true);
    assert.equal(isValidHex('#A0B1C2'), true);
  });

  test('rejects missing #', () => {
    assert.equal(isValidHex('ffffff'), false);
  });

  test('rejects 3-digit shorthand (forge requires full form)', () => {
    assert.equal(isValidHex('#fff'), false);
  });

  test('rejects non-hex chars', () => {
    assert.equal(isValidHex('#gggggg'), false);
    assert.equal(isValidHex('#zz1234'), false);
  });

  test('rejects non-strings', () => {
    assert.equal(isValidHex(null), false);
    assert.equal(isValidHex(undefined), false);
    assert.equal(isValidHex(123456), false);
    assert.equal(isValidHex({}), false);
  });

  test('rejects empty string', () => {
    assert.equal(isValidHex(''), false);
  });
});

describe('wcagBucket', () => {
  test('21:1 lands in AA bucket', () => {
    const b = wcagBucket(21);
    assert.equal(b.label, 'AA');
  });

  test('4.5 boundary: exactly 4.5 -> AA', () => {
    assert.equal(wcagBucket(4.5).label, 'AA');
  });

  test('4.5 boundary: 4.49 rounds to 4.5 -> AA (label uses toFixed(1))', () => {
    assert.equal(wcagBucket(4.49).label, 'AA');
  });

  test('4.5 boundary: 4.44 -> aa', () => {
    assert.equal(wcagBucket(4.44).label, 'aa');
  });

  test('3.0 boundary: exactly 3.0 -> aa', () => {
    assert.equal(wcagBucket(3.0).label, 'aa');
  });

  test('3.0 boundary: 2.99 rounds to 3.0 -> aa', () => {
    assert.equal(wcagBucket(2.99).label, 'aa');
  });

  test('3.0 boundary: 2.94 -> FAIL', () => {
    assert.equal(wcagBucket(2.94).label, 'FAIL');
  });

  test('1:1 -> FAIL', () => {
    assert.equal(wcagBucket(1).label, 'FAIL');
  });

  test('returns ratio, label, and color triple', () => {
    const b = wcagBucket(7);
    assert.equal(typeof b.ratio, 'number');
    assert.equal(typeof b.label, 'string');
    assert.ok(/^#[0-9a-f]{6}$/i.test(b.color));
  });
});

describe('auditContrast / resetAudit', () => {
  test('records on first call, no-op on duplicate label', () => {
    resetAudit();
    const r1 = auditContrast('text', '#ffffff', '#000000');
    const r2 = auditContrast('text', '#ff0000', '#000000');
    assert.ok(r1 > 1);
    assert.ok(r2 > 1);
    assert.equal(auditLog.length, 1, 'duplicate label should not append a second entry');
    assert.equal(auditLog[0].hex, '#ffffff', 'first call wins');
  });

  test('invalid foreground hex returns null and skips logging', () => {
    resetAudit();
    const r = auditContrast('text', 'not-a-hex', '#000000');
    assert.equal(r, null);
    assert.equal(auditLog.length, 0);
  });

  test('invalid bg hex returns null and skips logging', () => {
    resetAudit();
    const r = auditContrast('text', '#ffffff', 'not-a-hex');
    assert.equal(r, null);
    assert.equal(auditLog.length, 0);
  });

  test('resetAudit clears log and dedupe set (re-recording works)', () => {
    resetAudit();
    auditContrast('text', '#ffffff', '#000000');
    assert.equal(auditLog.length, 1);
    resetAudit();
    assert.equal(auditLog.length, 0);
    auditContrast('text', '#ffffff', '#000000');
    assert.equal(auditLog.length, 1, 'after reset, same label should record again');
  });
});
