// Tiny narrative-logging helper. Gated behind CC_THEME_CHECK_DEBUG so the
// default CLI experience stays quiet — a quick `cc-theme-check` invocation
// shouldn't print "Preparing to render… Successfully rendered…" trails.
//
// Enable with:
//   CC_THEME_CHECK_DEBUG=1 cc-theme-check --watch
//   CC_THEME_CHECK_DEBUG=1 cc-theme-check --edit
//
// The helper writes to stderr (Ink owns stdout in --edit). All values
// are emitted as key=value pairs so they grep cleanly.
import { chalk } from './colorize.mjs';

const enabled = Boolean(process.env.CC_THEME_CHECK_DEBUG);

export function debug(stage, fields = {}) {
  if (!enabled) return;
  const tags = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  process.stderr.write(chalk.dim(`[cc-theme-check] ${stage}${tags ? ' ' + tags : ''}\n`));
}
