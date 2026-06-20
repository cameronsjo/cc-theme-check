// Tests for src/config.mjs — persistent config path resolution, load, and save.
//
// Test Plan:
//   configPath()
//     [x] Happy: returns $XDG_CONFIG_HOME/cc-theme-check/config.json when env var is set
//     [x] Happy: falls back to {homedir}/.config/cc-theme-check/config.json when unset
//   loadConfig()
//     [x] Happy: returns {} when file doesn't exist (ENOENT)
//     [x] Happy: returns parsed JSON when file exists
//     [x] Unhappy: re-throws non-ENOENT errors (e.g. EACCES on unreadable file)
//   saveConfig(obj)
//     [x] Happy: creates parent directory if missing
//     [x] Happy: writes JSON with 2-space indentation and trailing newline
//     [x] Behavioral: round-trip — saveConfig({a:1}) then loadConfig() returns {a:1}

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

// Re-import the module fresh each time using dynamic import with a cache-bust
// isn't needed here because configPath() reads process.env at call time.
import { configPath, loadConfig, saveConfig } from '../src/config.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir;
let savedXdg;

function setupTmpDir() {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-theme-check-test-'));
  savedXdg = process.env.XDG_CONFIG_HOME;
}

function teardownTmpDir() {
  if (savedXdg === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = savedXdg;
  }
  rmSync(tmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// configPath()
// ---------------------------------------------------------------------------

describe('configPath()', () => {
  beforeEach(setupTmpDir);
  afterEach(teardownTmpDir);

  test('uses $XDG_CONFIG_HOME when env var is set', () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    const expected = join(tmpDir, 'cc-theme-check', 'config.json');
    assert.equal(configPath(), expected);
  });

  test('falls back to {homedir}/.config when XDG_CONFIG_HOME is unset', () => {
    delete process.env.XDG_CONFIG_HOME;
    const expected = join(homedir(), '.config', 'cc-theme-check', 'config.json');
    assert.equal(configPath(), expected);
  });
});

// ---------------------------------------------------------------------------
// loadConfig()
// ---------------------------------------------------------------------------

describe('loadConfig()', () => {
  beforeEach(setupTmpDir);
  afterEach(teardownTmpDir);

  test('returns {} when file does not exist (ENOENT)', async () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    // No file created — config.json is absent.
    const result = await loadConfig();
    assert.deepEqual(result, {});
  });

  test('returns parsed JSON when file exists', async () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'cc-theme-check');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), JSON.stringify({ themePath: '/a/b.json' }) + '\n', 'utf8');

    const result = await loadConfig();
    assert.deepEqual(result, { themePath: '/a/b.json' });
  });

  test('re-throws non-ENOENT errors', async () => {
    // Point XDG_CONFIG_HOME at a file (not a directory) so path resolution
    // produces a path whose parent is a file — any read attempt yields ENOTDIR.
    const fakeXdg = join(tmpDir, 'not-a-dir');
    writeFileSync(fakeXdg, 'block', 'utf8');
    process.env.XDG_CONFIG_HOME = fakeXdg;

    // loadConfig() will try to read fakeXdg/cc-theme-check/config.json.
    // The parent "fakeXdg/cc-theme-check" doesn't exist at all, so we'll
    // get ENOENT — which is the happy path. Use chmod to make a readable
    // directory unreadable instead.
    //
    // Strategy: create the config dir, write the file, then lock the dir.
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'cc-theme-check');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), '{}', 'utf8');
    // Remove read permission from the directory so readFile gets EACCES.
    chmodSync(configDir, 0o000);

    try {
      await assert.rejects(
        () => loadConfig(),
        (err) => {
          assert.notEqual(err.code, 'ENOENT', 'should not swallow the error as ENOENT');
          return true;
        }
      );
    } finally {
      // Restore permissions so teardown can delete the dir.
      chmodSync(configDir, 0o755);
    }
  });
});

// ---------------------------------------------------------------------------
// saveConfig(obj)
// ---------------------------------------------------------------------------

describe('saveConfig()', () => {
  beforeEach(setupTmpDir);
  afterEach(teardownTmpDir);

  test('creates parent directory if it does not exist', async () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    // The cc-theme-check sub-directory does not exist yet.
    await saveConfig({ bgOverride: '#123456' });

    const written = await readFile(join(tmpDir, 'cc-theme-check', 'config.json'), 'utf8');
    assert.ok(written.length > 0, 'file should have been created');
  });

  test('writes JSON with 2-space indentation and a trailing newline', async () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    const payload = { audit: true, palette: false };
    await saveConfig(payload);

    const raw = await readFile(join(tmpDir, 'cc-theme-check', 'config.json'), 'utf8');
    assert.equal(raw, JSON.stringify(payload, null, 2) + '\n');
  });

  test('round-trip: saveConfig({a:1}) then loadConfig() returns {a:1}', async () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    await saveConfig({ a: 1 });
    const result = await loadConfig();
    assert.deepEqual(result, { a: 1 });
  });

  test('rejects non-object payloads with TypeError (guards against null / arrays / scalars)', async () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    for (const bad of [null, [1, 2], 'string', 42, true]) {
      await assert.rejects(() => saveConfig(bad), TypeError);
    }
  });
});

// ---------------------------------------------------------------------------
// loadConfig() — shape guard
// ---------------------------------------------------------------------------

describe('loadConfig() shape guard', () => {
  beforeEach(setupTmpDir);
  afterEach(teardownTmpDir);

  test('returns {} when JSON parses to a non-object (null / array / scalar)', async () => {
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'cc-theme-check');
    mkdirSync(configDir, { recursive: true });
    for (const bad of ['null', '[1,2,3]', '"hello"', '42', 'true']) {
      writeFileSync(join(configDir, 'config.json'), bad);
      const result = await loadConfig();
      assert.deepEqual(result, {}, `non-object payload ${bad} should fall back to {}`);
    }
  });
});
