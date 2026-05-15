// Preview pane — runs the existing chalk-based renderConversation()
// against current overrides, captures the ANSI output, and embeds it
// in an Ink <Text> node. ANSI passes through Ink unmodified, so we
// reuse the entire verifier render pipeline with zero duplication.
import React from 'react';
import { Box, Text } from 'ink';
import { renderConversation } from '../../render/conversation.mjs';
import { resetAudit } from '../../contrast.mjs';

const h = React.createElement;

function captureConversation(overrides, canvasBg, ghosttyTheme) {
  const orig = process.stdout.write.bind(process.stdout);
  let buf = '';
  // Monkey-patch only during the render pass. Wrapped in try/finally so
  // a throwing render can't leak the mock into stdout.
  process.stdout.write = (chunk) => { buf += String(chunk); return true; };
  try {
    resetAudit();
    renderConversation(overrides, canvasBg, ghosttyTheme);
  } finally {
    process.stdout.write = orig;
  }
  return buf;
}

export function Preview({ state }) {
  const ansi = React.useMemo(
    () => captureConversation(state.overrides, state.canvasBg, state.ghosttyTheme),
    [state.overrides, state.canvasBg, state.ghosttyTheme],
  );
  return h(Box, { flexDirection: 'column', paddingX: 1, flexGrow: 1 },
    h(Text, { bold: true, dimColor: true }, 'PREVIEW'),
    h(Text, null, ansi),
  );
}
