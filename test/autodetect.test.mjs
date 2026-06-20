// Tests for src/autodetect.mjs — terminal sniffing and Ghostty config parsing.
// Filesystem fixtures are built in a mkdtempSync dir under $HOME so that
// os.homedir() (which honors $HOME on POSIX) points at the fake tree.
//
// Test Plan:
//   detectTerminal()
//     [x] Happy: 'Apple_Terminal' normalizes to 'Terminal.app'
//     [x] Happy: 'iTerm.app' normalizes to 'iTerm2'
//     [x] Happy: 'ghostty' normalizes to 'Ghostty'
//     [x] Happy: 'WezTerm' normalizes to 'WezTerm'
//     [x] Boundary: unknown TERM_PROGRAM returns the raw value
//     [x] Boundary: empty TERM_PROGRAM returns { name: null, ... }
//     [x] Behavioral: $TMUX set -> isTmux: true
//     [x] Behavioral: $TMUX unset -> isTmux: false
//   detectGhosttyTheme()
//     [x] Unhappy: config file absent -> null
//     [x] Unhappy: config exists but no theme line -> null
//     [x] Happy: 'theme = artificer-dark' resolves against themes dir
//     [x] Happy: absolute path 'theme = /tmp/foo' returned directly
//     [x] Boundary: theme name set but file missing -> { path: null, ... }
//     [x] Boundary: comment lines and blank lines are skipped
//     [x] Boundary: 'theme=val' (no spaces) accepted
//     [x] Boundary: 'theme = val' (extra spaces) accepted

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectTerminal, detectGhosttyTheme } from '../src/autodetect.mjs';

// ---------------------------------------------------------------------------
// detectTerminal
// ---------------------------------------------------------------------------

describe('detectTerminal', () => {
  let savedTermProgram;
  let savedTmux;

  beforeEach(() => {
    savedTermProgram = process.env.TERM_PROGRAM;
    savedTmux = process.env.TMUX;
  });

  afterEach(() => {
    if (savedTermProgram === undefined) {
      delete process.env.TERM_PROGRAM;
    } else {
      process.env.TERM_PROGRAM = savedTermProgram;
    }
    if (savedTmux === undefined) {
      delete process.env.TMUX;
    } else {
      process.env.TMUX = savedTmux;
    }
  });

  test("'Apple_Terminal' normalizes to 'Terminal.app'", () => {
    process.env.TERM_PROGRAM = 'Apple_Terminal';
    delete process.env.TMUX;
    const { name } = detectTerminal();
    assert.equal(name, 'Terminal.app');
  });

  test("'iTerm.app' normalizes to 'iTerm2'", () => {
    process.env.TERM_PROGRAM = 'iTerm.app';
    delete process.env.TMUX;
    const { name } = detectTerminal();
    assert.equal(name, 'iTerm2');
  });

  test("'ghostty' normalizes to 'Ghostty'", () => {
    process.env.TERM_PROGRAM = 'ghostty';
    delete process.env.TMUX;
    const { name } = detectTerminal();
    assert.equal(name, 'Ghostty');
  });

  test("'WezTerm' normalizes to 'WezTerm'", () => {
    process.env.TERM_PROGRAM = 'WezTerm';
    delete process.env.TMUX;
    const { name } = detectTerminal();
    assert.equal(name, 'WezTerm');
  });

  test('unknown TERM_PROGRAM returns its raw value', () => {
    process.env.TERM_PROGRAM = 'Hyper';
    delete process.env.TMUX;
    const { name } = detectTerminal();
    assert.equal(name, 'Hyper');
  });

  test('empty TERM_PROGRAM returns name: null', () => {
    process.env.TERM_PROGRAM = '';
    delete process.env.TMUX;
    const { name } = detectTerminal();
    assert.equal(name, null);
  });

  test('unset TERM_PROGRAM returns name: null', () => {
    delete process.env.TERM_PROGRAM;
    delete process.env.TMUX;
    const { name } = detectTerminal();
    assert.equal(name, null);
  });

  test('$TMUX set -> isTmux: true', () => {
    process.env.TERM_PROGRAM = 'ghostty';
    process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
    const { isTmux } = detectTerminal();
    assert.equal(isTmux, true);
  });

  test('$TMUX unset -> isTmux: false', () => {
    process.env.TERM_PROGRAM = 'ghostty';
    delete process.env.TMUX;
    const { isTmux } = detectTerminal();
    assert.equal(isTmux, false);
  });
});

// ---------------------------------------------------------------------------
// detectGhosttyTheme — filesystem fixture helpers
// ---------------------------------------------------------------------------

// Build a fake $HOME tree: <tmpDir>/.config/ghostty/config + themes/
function makeFakeHome() {
  const fakeHome = mkdtempSync(join(tmpdir(), 'cc-theme-check-test-'));
  mkdirSync(join(fakeHome, '.config', 'ghostty', 'themes'), { recursive: true });
  return fakeHome;
}

function writeGhosttyConfig(fakeHome, content) {
  writeFileSync(join(fakeHome, '.config', 'ghostty', 'config'), content, 'utf8');
}

function writeGhosttyTheme(fakeHome, name) {
  writeFileSync(join(fakeHome, '.config', 'ghostty', 'themes', name), '# theme stub\n', 'utf8');
}

describe('detectGhosttyTheme', () => {
  let fakeHome;
  let savedHome;

  beforeEach(() => {
    savedHome = process.env.HOME;
    fakeHome = makeFakeHome();
    process.env.HOME = fakeHome;
  });

  afterEach(() => {
    if (savedHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = savedHome;
    }
    rmSync(fakeHome, { recursive: true, force: true });
  });

  test('returns null when config file is absent', () => {
    // Config dir exists but config file was not written
    assert.equal(detectGhosttyTheme(), null);
  });

  test('returns null when config exists but has no theme line', () => {
    writeGhosttyConfig(fakeHome, '# just a comment\nfont-size = 14\n');
    assert.equal(detectGhosttyTheme(), null);
  });

  test("parses 'theme = artificer-dark' and resolves against themes dir", () => {
    writeGhosttyTheme(fakeHome, 'artificer-dark');
    writeGhosttyConfig(fakeHome, 'theme = artificer-dark\n');
    const result = detectGhosttyTheme();
    assert.ok(result !== null, 'expected a result object');
    assert.equal(result.themeName, 'artificer-dark');
    assert.ok(result.path.endsWith('themes/artificer-dark'), `unexpected path: ${result.path}`);
    assert.ok(existsSync(result.path));
    assert.ok(result.configPath.endsWith('ghostty/config'));
  });

  test('absolute path theme returns that path directly', () => {
    // Write the theme file at an absolute path inside the fake home
    const absThemePath = join(fakeHome, 'my-theme.conf');
    writeFileSync(absThemePath, '# abs theme\n', 'utf8');
    writeGhosttyConfig(fakeHome, `theme = ${absThemePath}\n`);
    const result = detectGhosttyTheme();
    assert.ok(result !== null);
    assert.equal(result.themeName, absThemePath);
    assert.equal(result.path, absThemePath);
  });

  test('returns { path: null } when theme name is set but file is missing', () => {
    writeGhosttyConfig(fakeHome, 'theme = ghost-theme\n');
    // Do not write the theme file
    const result = detectGhosttyTheme();
    assert.ok(result !== null, 'expected a result object, not null');
    assert.equal(result.themeName, 'ghost-theme');
    assert.equal(result.path, null);
    assert.ok(result.configPath.endsWith('ghostty/config'));
  });

  test('comment lines and blank lines are skipped', () => {
    writeGhosttyTheme(fakeHome, 'ocean-dark');
    writeGhosttyConfig(fakeHome, [
      '# this is a comment',
      '',
      '  # another comment',
      'font-size = 14',
      'theme = ocean-dark',
    ].join('\n') + '\n');
    const result = detectGhosttyTheme();
    assert.ok(result !== null);
    assert.equal(result.themeName, 'ocean-dark');
  });

  test("'theme=val' (no spaces around =) is accepted", () => {
    writeGhosttyTheme(fakeHome, 'minimal');
    writeGhosttyConfig(fakeHome, 'theme=minimal\n');
    const result = detectGhosttyTheme();
    assert.ok(result !== null);
    assert.equal(result.themeName, 'minimal');
  });

  test("'theme = val' (extra surrounding spaces) is accepted", () => {
    writeGhosttyTheme(fakeHome, 'spacious');
    writeGhosttyConfig(fakeHome, '  theme   =   spacious  \n');
    const result = detectGhosttyTheme();
    assert.ok(result !== null);
    assert.equal(result.themeName, 'spacious');
  });
});
