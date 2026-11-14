/**
 * Extracts a 1-based inclusive line range from `text`, auto-detecting the
 * file's line ending (`\r\n`, `\n`, or `\r`, in that priority).
 *
 * Mixed line endings are not supported: detection picks one and uses it for
 * both the split and the rejoin, so files that mix conventions will not slice
 * cleanly. When neither `startLine` nor `endLine` is provided, the input is
 * returned unchanged. `endLine` past EOF clamps to the last line.
 */
export function extractLines({
  text,
  startLine,
  endLine,
}: {
  text: string;
  startLine?: number;
  endLine?: number;
}): string {
  if (startLine == null && endLine == null) return text;
  const lineEnding = text.includes('\r\n')
    ? '\r\n'
    : text.includes('\n')
      ? '\n'
      : text.includes('\r')
        ? '\r'
        : '\n';
  const lines = text.split(lineEnding);
  const start = Math.max(1, startLine ?? 1) - 1;
  const end = Math.min(lines.length, endLine ?? lines.length);
  return lines.slice(start, end).join(lineEnding);
}
