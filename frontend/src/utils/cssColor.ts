interface RgbColor {
  red: number
  green: number
  blue: number
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function parseChannel(value: string): number | null {
  const numeric = Number.parseFloat(value)
  if (!Number.isFinite(numeric)) return null
  return clampChannel(value.endsWith('%') ? (numeric / 100) * 255 : numeric)
}

function parseHex(value: string): RgbColor | null {
  const match = value.match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i)
  if (!match) return null
  const raw = match[1]!
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((part) => part + part)
          .join('')
      : raw.slice(0, 6)
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  }
}

function parseRgbFunction(value: string): RgbColor | null {
  const match = value.match(/^rgba?\((.+)\)$/i)
  if (!match) return null
  const channels = match[1]!
    .split('/')[0]!
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map(parseChannel)
  if (channels.length !== 3 || channels.some((channel) => channel === null)) {
    return null
  }
  return {
    red: channels[0]!,
    green: channels[1]!,
    blue: channels[2]!,
  }
}

function parseSrgbFunction(value: string): RgbColor | null {
  const match = value.match(/^color\(srgb\s+(.+)\)$/i)
  if (!match) return null
  const channels = match[1]!
    .split('/')[0]!
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((channel) => clampChannel(Number.parseFloat(channel) * 255))
  if (
    channels.length !== 3 ||
    channels.some((channel) => !Number.isFinite(channel))
  ) {
    return null
  }
  return { red: channels[0]!, green: channels[1]!, blue: channels[2]! }
}

function parseColor(value: string): RgbColor | null {
  const normalized = value.trim()
  return (
    parseHex(normalized) ||
    parseRgbFunction(normalized) ||
    parseSrgbFunction(normalized)
  )
}

function channelHex(value: number): string {
  return value.toString(16).padStart(2, '0')
}

export function normalizeOpaqueColor(value: string, fallback: string): string {
  const color = parseColor(value) || parseColor(fallback)
  if (!color) return fallback
  return `#${channelHex(color.red)}${channelHex(color.green)}${channelHex(color.blue)}`
}
