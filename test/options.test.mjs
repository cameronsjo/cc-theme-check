// Tests for src/options.mjs — resolveOptions() precedence chain.
//
// Strategy: true integration coverage via env + filesystem fixtures.
//   - XDG_CONFIG_HOME is redirected to a per-test tmp dir so loadConfig()
//     reads our fake config.json instead of the real user config.
//   - HOME is redirected so homedir()-based paths (Ghostty config,
//     ghosttyThemes dir) land in the same tmp dir.
//   - TERM_PROGRAM / TMUX are saved and restored so detectTerminal()
//     stays deterministic.
//   - No mocking framework; node:test + assert/strict only.
//
// Test Plan:
//   ghosttyPath precedence
//     [x] Flag: rawCli.ghosttyPath wins over settings + autodetect
//     [x] Settings (absolute): settings.ghosttyTheme absolute path used directly
//     [x] Settings (name): theme-name resolved via ~/.config/ghostty/themes/<name>
//     [x] Settings (name) miss: name not found → drops to autodetect
//     [x] Autodetect: rawCli null, settings null, Ghostty config provides theme
//     [x] Default: all null → ghosttyPath null, source 'default'
//   bgOverride + themePath precedence
//     [x] Flag wins for bgOverride
//     [x] Settings wins for bgOverride when no flag
//     [x] Default when neither present
//     [x] Flag wins for themePath
//     [x] Settings wins for themePath when no flag
//   Boolean flags (audit / palette / tokens)
//     [x] defaultFlags.all turns on all three with source 'settings'
//     [x] defaultFlags.audit alone turns on audit, not palette/tokens
//     [x] rawCli.audit=true wins regardless of settings, source 'flag'
//   autodetect bag
//     [x] result.autodetect exposes terminal and ghostty fields
//   sources map
//     [x] sources keys are populated for all resolved fields

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Env save/restore + tmp dir helpers
// ---------------------------------------------------------------------------

const ENV_KEYS = ['HOME', 'XDG_CONFIG_HOME', 'TERM_PROGRAM', 'TMUX'];

function saveEnv() {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  return saved;
}

function restoreEnv(saved) {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

// Build the baseline rawCli object. Every field the resolver touches
// defaults to its "not provided" value.
function rawCli(overrides = {}) {
  return {
    ghosttyPath: null,
    bgOverride:  null,
    themePath:   null,
    audit:       false,
    palette:     false,
    tokens:      false,
    watch:       false,
    edit:        false,
    init:        false,
    initSlug:    null,
    ...overrides,
  };
}

// Write the cc-theme-check config.json under XDG_CONFIG_HOME.
function writeConfig(xdgDir, contents) {
  const dir = join(xdgDir, 'cc-theme-check');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(contents), 'utf8');
}

// Write a minimal Ghostty config file so detectGhosttyTheme() finds a theme.
function writeGhosttyConfig(homeDir, themeLine) {
  const dir = join(homeDir, '.config', 'ghostty');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config'), `font-size = 14\n${themeLine}\n`, 'utf8');
}

// Write an empty file at ~/.config/ghostty/themes/<name>.
function writeGhosttyTheme(homeDir, name) {
  const dir = join(homeDir, '.config', 'ghostty', 'themes');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), '', 'utf8');
}

// ---------------------------------------------------------------------------
// Module cache busting — options.mjs (and its deps) must be re-imported
// fresh each time because config.mjs and autodetect.mjs read env vars at
// call time, not import time. Node's ESM cache is keyed by URL, so we
// bust it with a dummy query param that's stripped before loading.
//
// We use a Map-based registry and a ?v=N version suffix to force fresh
// evaluation. The underlying source files are stable; only process.env
// changes between test cases, and each importFresh call builds a new
// module instance with the current env.
// ---------------------------------------------------------------------------

let _importSeq = 0;
async function importResolveOptions() {
  // Node 18+ supports import() with URL strings. We append a version query
  // so the module loader treats each call as a distinct specifier.
  const seq = ++_importSeq;
  const url = new URL(`../src/options.mjs?v=${seq}`, import.meta.url).href;
  const mod = await import(url);
  return mod.resolveOptions;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('resolveOptions — ghosttyPath precedence', () => {
  let tmp, xdg, savedEnv;

  beforeEach(() => {
    savedEnv = saveEnv();
    tmp = mkdtempSync(join(tmpdir(), 'cc-opt-'));
    xdg = join(tmp, 'xdg');
    mkdirSync(xdg, { recursive: true });
    process.env.HOME = tmp;
    process.env.XDG_CONFIG_HOME = xdg;
    // Neutral terminal env so detectTerminal() is predictable
    delete process.env.TERM_PROGRAM;
    delete process.env.TMUX;
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    rmSync(tmp, { recursive: true, force: true });
  });

  test('CLI flag wins over settings + autodetect', async () => {
    // Settings has a ghosttyTheme, Ghostty config also has one — flag wins.
    writeConfig(xdg, { ghosttyTheme: '/settings/theme' });
    writeGhosttyConfig(tmp, 'theme = auto-theme');
    writeGhosttyTheme(tmp, 'auto-theme');

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli({ ghosttyPath: '/cli/override' }));

    assert.equal(result.ghosttyPath, '/cli/override');
    assert.equal(result.sources.ghosttyPath, 'flag');
  });

  test('settings absolute path used directly (no themes-dir lookup)', async () => {
    // Absolute path in settings — used verbatim, no existence check.
    writeConfig(xdg, { ghosttyTheme: '/abs/path/to/theme' });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.ghosttyPath, '/abs/path/to/theme');
    assert.equal(result.sources.ghosttyPath, 'settings');
  });

  test('settings name resolved via ~/.config/ghostty/themes/<name>', async () => {
    writeConfig(xdg, { ghosttyTheme: 'my-theme' });
    writeGhosttyTheme(tmp, 'my-theme');

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    const expected = join(tmp, '.config', 'ghostty', 'themes', 'my-theme');
    assert.equal(result.ghosttyPath, expected);
    assert.equal(result.sources.ghosttyPath, 'settings');
  });

  test('settings name not found → drops to autodetect', async () => {
    // Settings names a theme that doesn't exist on disk.
    // Ghostty config does have a theme → autodetect wins.
    writeConfig(xdg, { ghosttyTheme: 'missing-theme' });
    writeGhosttyConfig(tmp, 'theme = detected-theme');
    writeGhosttyTheme(tmp, 'detected-theme');

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    const expected = join(tmp, '.config', 'ghostty', 'themes', 'detected-theme');
    assert.equal(result.ghosttyPath, expected);
    assert.equal(result.sources.ghosttyPath, 'autodetect');
  });

  test('autodetect when rawCli null and settings null', async () => {
    // No settings file, but Ghostty config has a theme.
    writeGhosttyConfig(tmp, 'theme = ghostty-theme');
    writeGhosttyTheme(tmp, 'ghostty-theme');

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    const expected = join(tmp, '.config', 'ghostty', 'themes', 'ghostty-theme');
    assert.equal(result.ghosttyPath, expected);
    assert.equal(result.sources.ghosttyPath, 'autodetect');
  });

  test('default when all sources are absent', async () => {
    // No settings, no Ghostty config → ghosttyPath null.
    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.ghosttyPath, null);
    assert.equal(result.sources.ghosttyPath, 'default');
  });
});

// ---------------------------------------------------------------------------

describe('resolveOptions — bgOverride + themePath precedence', () => {
  let tmp, xdg, savedEnv;

  beforeEach(() => {
    savedEnv = saveEnv();
    tmp = mkdtempSync(join(tmpdir(), 'cc-opt-'));
    xdg = join(tmp, 'xdg');
    mkdirSync(xdg, { recursive: true });
    process.env.HOME = tmp;
    process.env.XDG_CONFIG_HOME = xdg;
    delete process.env.TERM_PROGRAM;
    delete process.env.TMUX;
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    rmSync(tmp, { recursive: true, force: true });
  });

  test('CLI flag wins for bgOverride', async () => {
    writeConfig(xdg, { bgOverride: '#333333' });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli({ bgOverride: '#111111' }));

    assert.equal(result.bgOverride, '#111111');
    assert.equal(result.sources.bgOverride, 'flag');
  });

  test('settings wins for bgOverride when no flag', async () => {
    writeConfig(xdg, { bgOverride: '#333333' });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.bgOverride, '#333333');
    assert.equal(result.sources.bgOverride, 'settings');
  });

  test('bgOverride defaults to null when neither present', async () => {
    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.bgOverride, null);
    assert.equal(result.sources.bgOverride, 'default');
  });

  test('CLI flag wins for themePath', async () => {
    writeConfig(xdg, { themePath: '/settings/theme.json' });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli({ themePath: '/cli/theme.json' }));

    assert.equal(result.themePath, '/cli/theme.json');
    assert.equal(result.sources.themePath, 'flag');
  });

  test('settings wins for themePath when no flag', async () => {
    writeConfig(xdg, { themePath: '/settings/theme.json' });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.themePath, '/settings/theme.json');
    assert.equal(result.sources.themePath, 'settings');
  });
});

// ---------------------------------------------------------------------------

describe('resolveOptions — boolean flags (audit / palette / tokens)', () => {
  let tmp, xdg, savedEnv;

  beforeEach(() => {
    savedEnv = saveEnv();
    tmp = mkdtempSync(join(tmpdir(), 'cc-opt-'));
    xdg = join(tmp, 'xdg');
    mkdirSync(xdg, { recursive: true });
    process.env.HOME = tmp;
    process.env.XDG_CONFIG_HOME = xdg;
    delete process.env.TERM_PROGRAM;
    delete process.env.TMUX;
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    rmSync(tmp, { recursive: true, force: true });
  });

  test('defaultFlags.all turns on all three with source settings', async () => {
    writeConfig(xdg, { defaultFlags: { all: true } });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.audit,   true);
    assert.equal(result.palette, true);
    assert.equal(result.tokens,  true);
    assert.equal(result.sources.audit,   'settings');
    assert.equal(result.sources.palette, 'settings');
    assert.equal(result.sources.tokens,  'settings');
  });

  test('defaultFlags.audit alone turns on audit but not palette/tokens', async () => {
    writeConfig(xdg, { defaultFlags: { audit: true } });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.audit,   true);
    assert.equal(result.palette, false);
    assert.equal(result.tokens,  false);
    assert.equal(result.sources.audit,   'settings');
    assert.equal(result.sources.palette, 'default');
    assert.equal(result.sources.tokens,  'default');
  });

  test('rawCli.audit=true wins, source is flag', async () => {
    // Even if settings also sets audit, the flag source is reported.
    writeConfig(xdg, { defaultFlags: { audit: true } });

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli({ audit: true }));

    assert.equal(result.audit, true);
    assert.equal(result.sources.audit, 'flag');
  });

  test('all three flags default to false with source default when nothing set', async () => {
    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.audit,   false);
    assert.equal(result.palette, false);
    assert.equal(result.tokens,  false);
    assert.equal(result.sources.audit,   'default');
    assert.equal(result.sources.palette, 'default');
    assert.equal(result.sources.tokens,  'default');
  });
});

// ---------------------------------------------------------------------------

describe('resolveOptions — autodetect bag', () => {
  let tmp, xdg, savedEnv;

  beforeEach(() => {
    savedEnv = saveEnv();
    tmp = mkdtempSync(join(tmpdir(), 'cc-opt-'));
    xdg = join(tmp, 'xdg');
    mkdirSync(xdg, { recursive: true });
    process.env.HOME = tmp;
    process.env.XDG_CONFIG_HOME = xdg;
    process.env.TERM_PROGRAM = 'ghostty';
    delete process.env.TMUX;
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    rmSync(tmp, { recursive: true, force: true });
  });

  test('result.autodetect exposes terminal and ghostty fields', async () => {
    writeGhosttyConfig(tmp, 'theme = my-theme');
    writeGhosttyTheme(tmp, 'my-theme');

    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.ok('terminal' in result.autodetect, 'autodetect.terminal should be present');
    assert.ok('ghostty' in result.autodetect,  'autodetect.ghostty should be present');
    assert.equal(result.autodetect.terminal.name, 'Ghostty');
  });

  test('autodetect.ghostty is null when no Ghostty config present', async () => {
    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    assert.equal(result.autodetect.ghostty, null);
  });
});

// ---------------------------------------------------------------------------

describe('resolveOptions — sources map completeness', () => {
  let tmp, xdg, savedEnv;

  beforeEach(() => {
    savedEnv = saveEnv();
    tmp = mkdtempSync(join(tmpdir(), 'cc-opt-'));
    xdg = join(tmp, 'xdg');
    mkdirSync(xdg, { recursive: true });
    process.env.HOME = tmp;
    process.env.XDG_CONFIG_HOME = xdg;
    delete process.env.TERM_PROGRAM;
    delete process.env.TMUX;
  });

  afterEach(() => {
    restoreEnv(savedEnv);
    rmSync(tmp, { recursive: true, force: true });
  });

  test('sources contains an entry for every resolved field', async () => {
    const resolveOptions = await importResolveOptions();
    const result = await resolveOptions(rawCli());

    const expectedFields = ['ghosttyPath', 'bgOverride', 'themePath', 'audit', 'palette', 'tokens'];
    for (const field of expectedFields) {
      assert.ok(field in result.sources, `sources.${field} should be set`);
      assert.ok(
        ['flag', 'settings', 'autodetect', 'default'].includes(result.sources[field]),
        `sources.${field} should be a valid source label, got '${result.sources[field]}'`,
      );
    }
  });
});
