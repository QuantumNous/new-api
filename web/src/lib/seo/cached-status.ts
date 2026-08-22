/**
 * Read and parse the cached /api/status payload from localStorage.
 * Returns null if the key is missing, JSON is invalid, or the result is not a plain object.
 */
export function readCachedStatus(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem('status')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* empty */
  }
  return null
}
