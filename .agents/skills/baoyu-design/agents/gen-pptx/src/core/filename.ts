// Sanitize a user-supplied basename (no extension) into a filesystem-safe name.
// Preserves Unicode letters/numbers (CJK, Cyrillic, Arabic, accented Latin);
// anything outside [letters, numbers, - _ . space] becomes "_". Never empty.
export function safeBasename(filename: string | undefined, fallback: string): string {
  const cleaned = (filename ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\-_. ]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return cleaned || fallback;
}
