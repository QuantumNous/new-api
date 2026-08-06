export type ApiMode = 'mock' | 'http'

/** Resolve the transport mode once so every API surface follows the same contract. */
export function resolveApiMode(
  value: unknown,
  variable = 'VITE_API_MODE'
): ApiMode {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!normalized || normalized === 'mock') return 'mock'
  if (normalized === 'http') return 'http'
  throw new Error(
    `Unsupported ${variable} "${String(value)}"; expected "mock" or "http"`
  )
}

const apiMode = resolveApiMode(
  import.meta.env.VITE_API_MODE || (import.meta.env.PROD ? 'http' : 'mock')
)
export const isMockApi = apiMode === 'mock'

/** Public pages may be overridden independently for deterministic HTTP fixtures. */
export const publicApiMode = resolveApiMode(
  import.meta.env.VITE_PUBLIC_API_MODE || apiMode,
  'VITE_PUBLIC_API_MODE'
)
