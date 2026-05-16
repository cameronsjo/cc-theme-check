// Tests for cli.mjs::shouldOpenMenu — the routing predicate that decides
// whether bare `cc-theme-check` opens the launcher TUI or falls through to
// one-shot verify. The function is pure given a raw opts bag and the TTY
// state of process.stdin/stdout.
//
// Test Plan:
//   shouldOpenMenu(raw) (Classification: pure logic with env reads)
//     [x] Happy: TTY + no flags + no themePath → opens menu
//     [x] Behavioral: --menu forces launcher even when piped
//     [x] Behavioral: --verify forces one-shot even in TTY
//     [x] Behavioral: --menu wins over --verify (menu checked first)
//     [x] Behavioral: --watch short-circuits to false (existing mode flag)
//     [x] Behavioral: --edit short-circuits to false
//     [x] Behavioral: --init short-circuits to false
//     [x] Behavioral: themePath positional short-circuits to false
//     [x] Boundary: stdin not TTY → false (piped input)
//     [x] Boundary: stdout not TTY → false (piped output)
//     [x] Boundary: neither TTY → false
//   (skip) main() — orchestration over real I/O + dynamic imports; integration territory
//   (skip) parseArgs / showHelp — covered indirectly by existing usage; mostly string formatting

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { shouldOpenMenu } from '../src/cli.mjs';

// Snapshot and restore the TTY descriptors so each test can run in isolation
// regardless of how the suite itself was invoked (TTY vs CI piped).
let savedStdin;
let savedStdout;

beforeEach(() => {
  savedStdin  = process.stdin.isTTY;
  savedStdout = process.stdout.isTTY;
});

afterEach(() => {
  process.stdin.isTTY  = savedStdin;
  process.stdout.isTTY = savedStdout;
});

function setTTY(stdin, stdout) {
  process.stdin.isTTY  = stdin;
  process.stdout.isTTY = stdout;
}

function rawOpts(overrides = {}) {
  return {
    menu: false, verify: false, watch: false, edit: false, init: false,
    themePath: null,
    ...overrides,
  };
}

describe('shouldOpenMenu — TTY + no overrides', () => {
  test('both TTY, no flags, no theme → true', () => {
    setTTY(true, true);
    assert.equal(shouldOpenMenu(rawOpts()), true);
  });
});

describe('shouldOpenMenu — explicit flags', () => {
  test('--menu forces true even when piped', () => {
    setTTY(false, false);
    assert.equal(shouldOpenMenu(rawOpts({ menu: true })), true);
  });

  test('--verify forces false even in TTY', () => {
    setTTY(true, true);
    assert.equal(shouldOpenMenu(rawOpts({ verify: true })), false);
  });

  test('--menu wins over --verify (menu checked first)', () => {
    setTTY(true, true);
    assert.equal(shouldOpenMenu(rawOpts({ menu: true, verify: true })), true);
  });
});

describe('shouldOpenMenu — mode-flag short-circuits', () => {
  test('--watch short-circuits to false', () => {
    setTTY(true, true);
    assert.equal(shouldOpenMenu(rawOpts({ watch: true })), false);
  });

  test('--edit short-circuits to false', () => {
    setTTY(true, true);
    assert.equal(shouldOpenMenu(rawOpts({ edit: true })), false);
  });

  test('--init short-circuits to false', () => {
    setTTY(true, true);
    assert.equal(shouldOpenMenu(rawOpts({ init: true })), false);
  });

  test('positional themePath short-circuits to false', () => {
    setTTY(true, true);
    assert.equal(shouldOpenMenu(rawOpts({ themePath: 'my-theme.json' })), false);
  });
});

describe('shouldOpenMenu — TTY boundary conditions', () => {
  test('stdin piped, stdout TTY → false', () => {
    setTTY(false, true);
    assert.equal(shouldOpenMenu(rawOpts()), false);
  });

  test('stdin TTY, stdout piped → false', () => {
    setTTY(true, false);
    assert.equal(shouldOpenMenu(rawOpts()), false);
  });

  test('neither TTY (CI / fully piped) → false', () => {
    setTTY(false, false);
    assert.equal(shouldOpenMenu(rawOpts()), false);
  });

  test('undefined isTTY (typical for piped) coerces to false', () => {
    setTTY(undefined, undefined);
    assert.equal(shouldOpenMenu(rawOpts()), false);
  });
});
