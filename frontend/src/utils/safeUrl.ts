const WEB_PROTOCOLS = new Set(['http:', 'https:'])
const FALLBACK_ORIGIN = 'https://ren2hub.invalid'
const SAFE_SVG_TAGS = new Set([
  'svg',
  'defs',
  'lineargradient',
  'stop',
  'rect',
  'polyline',
  'text',
])
const SAFE_SVG_ATTRIBUTES = new Set([
  'xmlns',
  'width',
  'height',
  'viewbox',
  'id',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'offset',
  'stop-color',
  'fill',
  'font-family',
  'font-size',
  'text-anchor',
  'dominant-baseline',
  'rx',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'points',
])

function isSafeSvgDataUri(value: string): boolean {
  const prefix = 'data:image/svg+xml;utf8,'
  if (!value.toLowerCase().startsWith(prefix)) return false
  let markup: string
  try {
    markup = decodeURIComponent(value.slice(prefix.length))
  } catch {
    return false
  }
  if (markup.length > 100_000 || !/^\s*<svg\b[\s\S]*<\/svg>\s*$/i.test(markup))
    return false
  if (
    /[<](?:script|style|foreignObject|iframe|image|use)\b|\bon[a-z-]+\s*=|(?:javascript:|url\s*\((?!#g\)))/i.test(
      markup
    )
  )
    return false

  const tags = [...markup.matchAll(/<\/?([a-z][\w:-]*)\b/gi)]
  if (tags.some((match) => !SAFE_SVG_TAGS.has(match[1].toLowerCase())))
    return false
  const openingTags = [
    ...markup.matchAll(/<([a-z][\w:-]*)\b([^>]*?)(?:\/?)>/gi),
  ]
  for (const [, , attributes] of openingTags) {
    for (const match of attributes.matchAll(
      /([:\w-]+)\s*=\s*(['"])(.*?)\2/gi
    )) {
      const name = match[1].toLowerCase()
      const value = match[3]
      if (!SAFE_SVG_ATTRIBUTES.has(name) || /[<>]/.test(value)) return false
    }
  }
  return true
}

function currentOrigin(): string {
  return typeof window === 'undefined'
    ? FALLBACK_ORIGIN
    : window.location.origin
}

function parseUrl(value: unknown, base: string): URL | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    return new URL(value.trim(), base)
  } catch {
    return null
  }
}

function parseAllowedOrigins(values: readonly string[]): Set<string> {
  const origins = new Set<string>()
  for (const value of values) {
    const parsed = parseUrl(value, currentOrigin())
    if (parsed && WEB_PROTOCOLS.has(parsed.protocol)) origins.add(parsed.origin)
  }
  return origins
}

const configuredOrigins = parseAllowedOrigins(
  (import.meta.env.VITE_TRUSTED_EXTERNAL_ORIGINS || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean)
)

function isAllowedOrigin(
  origin: string,
  allowedOrigins: readonly string[]
): boolean {
  if (origin === currentOrigin()) return true
  const allowed = new Set(configuredOrigins)
  for (const originValue of parseAllowedOrigins(allowedOrigins)) {
    allowed.add(originValue)
  }
  return allowed.has(origin)
}

export function safeExternalUrl(
  value: unknown,
  allowedOrigins: readonly string[] = []
): string | null {
  const base = currentOrigin()
  const parsed = parseUrl(value, base)
  if (
    !parsed ||
    !WEB_PROTOCOLS.has(parsed.protocol) ||
    !isAllowedOrigin(parsed.origin, allowedOrigins)
  ) {
    return null
  }
  return parsed.href
}

export function safeImageUrl(
  value: unknown,
  allowedOrigins: readonly string[] = []
): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim()
  if (
    /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(candidate)
  ) {
    return candidate
  }
  if (isSafeSvgDataUri(candidate)) return candidate
  const base = currentOrigin()
  const parsed = parseUrl(candidate, base)
  if (!parsed) return null

  if (parsed.protocol === 'blob:') {
    return isAllowedOrigin(parsed.origin, allowedOrigins) ? parsed.href : null
  }

  if (
    !WEB_PROTOCOLS.has(parsed.protocol) ||
    !isAllowedOrigin(parsed.origin, allowedOrigins)
  )
    return null
  return parsed.href
}
