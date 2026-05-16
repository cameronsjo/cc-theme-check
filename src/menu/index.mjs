// Launcher entry — renders the Menu, waits for the user to pick a mode,
// then unmounts and returns the choice. The caller (cli.mjs) dispatches
// to the appropriate mode handler. We unmount before launching the next
// mode so the forge's own render() call doesn't nest inside ours.
import React from 'react';
import { render } from 'ink';
import { loadConfig } from '../config.mjs';
import { debug } from '../debug.mjs';
import { Menu } from './components/Menu.mjs';

export async function launchMenu({ resolved }) {
  debug('menu launch start', {});
  const settings = await loadConfig();

  return new Promise((resolve) => {
    let done = false;
    const finish = (choice) => {
      if (done) return;
      done = true;
      debug('menu choice', { action: choice.action });
      unmount();
      resolve(choice);
    };

    const { unmount, waitUntilExit } = render(
      React.createElement(Menu, {
        resolved,
        settings,
        onChoice: finish,
      }),
      { exitOnCtrlC: true },
    );

    // If Ink exits without a choice (e.g. Ctrl-C), treat as quit.
    waitUntilExit().then(
      () => finish({ action: 'quit' }),
      (err) => { debug('menu exit error', { error: err.message }); finish({ action: 'quit' }); },
    );
  });
}
