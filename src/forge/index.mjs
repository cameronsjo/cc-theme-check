// Forge entry — only loaded via dynamic import from cli.mjs when --edit
// is set. The top-level `import 'ink'` here is what triggers
// ERR_MODULE_NOT_FOUND if the optional peerDeps aren't installed, which
// cli.mjs catches and turns into a clean install hint.
import React from 'react';
import { render } from 'ink';
import { loadTheme } from '../discover.mjs';
import { loadGhosttyTheme } from '../ghostty.mjs';
import { resolveCanvasBg } from '../render-all.mjs';
import { Forge } from './components/Forge.mjs';

export async function launchForge({ themePath, opts }) {
  const { raw } = loadTheme(themePath);
  const overrides = raw.overrides ?? {};
  const ghosttyTheme = opts.ghosttyPath ? loadGhosttyTheme(opts.ghosttyPath) : null;
  const canvasBg = resolveCanvasBg(opts, raw, ghosttyTheme);

  const { waitUntilExit } = render(
    React.createElement(Forge, {
      initialProps: {
        overrides,
        canvasBg,
        themePath,
        ghosttyTheme,
        themeRaw: raw,
      },
    }),
    { exitOnCtrlC: true },
  );
  await waitUntilExit();
}
