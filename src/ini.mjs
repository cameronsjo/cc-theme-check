// Minimal INI-style `key = value` parser shared by Ghostty config and
// theme files. Lenient: accepts any amount of whitespace around `=`,
// skips blank lines and `#` comments, splits on the FIRST `=` so
// values like `palette = 0=#1a1d2e` survive (key=`palette`, value=
// `0=#1a1d2e`).
export function parseIniLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq === -1) return null;
  return {
    key: trimmed.slice(0, eq).trim(),
    value: trimmed.slice(eq + 1).trim(),
  };
}
