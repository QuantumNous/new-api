const STALE_CHUNK_RELOAD_COOLDOWN_MS = 60_000

const STALE_CHUNK_ERROR_PATTERNS = [
  /chunkloaderror/i,
  /loading chunk \d+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
]

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  if (typeof error === 'string') return error
  if (typeof error !== 'object' || error === null) return ''

  const candidate = error as Record<string, unknown>
  const name = typeof candidate.name === 'string' ? candidate.name : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  return `${name}: ${message}`
}

export function isStaleChunkLoadError(error: unknown): boolean {
  const description = describeError(error)
  return STALE_CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(description))
}

export function canReloadStaleChunk(
  lastReloadAt: string | null,
  now = Date.now()
): boolean {
  if (!lastReloadAt) return true

  const parsedLastReloadAt = Number(lastReloadAt)
  if (!Number.isFinite(parsedLastReloadAt)) return true
  return now - parsedLastReloadAt >= STALE_CHUNK_RELOAD_COOLDOWN_MS
}
