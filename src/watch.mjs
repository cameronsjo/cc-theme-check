// --watch mode: re-render on every theme-file change. Watches the parent
// directory and filters by filename so editors that save via rename
// (write-to-.tmp + mv) don't lose the watch when the inode changes.
import { watch } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import { chalk } from './colorize.mjs';
import { debug } from './debug.mjs';
import { runOnce } from './render-all.mjs';

const DEBOUNCE_MS = 50;

export async function watchAndRender(themePath, opts) {
  const ac = new AbortController();
  const exit = () => { ac.abort(); process.stdout.write('\n'); process.exit(0); };
  process.on('SIGINT', exit);
  process.on('SIGTERM', exit);

  const renderNow = () => {
    try {
      console.clear();
      process.stdout.write(chalk.dim(`  ↻ watching ${themePath}  (Ctrl-C to exit)\n`));
      runOnce(themePath, opts);
    } catch (err) {
      debug('render failed', { themePath, error: err.message });
      process.stdout.write(chalk.red(`  ✗ render failed: ${err.message}\n`));
    }
  };

  debug('watch start', { themePath });
  process.stdout.on('resize', renderNow);
  renderNow();

  let pending = null;
  const dir = dirname(themePath);
  const targetName = basename(themePath);

  try {
    for await (const event of watch(dir, { signal: ac.signal })) {
      if (event.filename !== targetName) continue;
      debug('file changed', { filename: event.filename });
      if (pending) clearTimeout(pending);
      pending = setTimeout(renderNow, DEBOUNCE_MS);
    }
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
    debug('watch cancelled');
  }
}
