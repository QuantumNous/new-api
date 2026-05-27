import { DEFAULT_LOGO } from '../lib/constants.ts'

const LEGACY_AIAPI114_LOGO_URLS = new Set([
  'https://aiapi114.com/aiapi-favorite.ico',
  'https://www.aiapi114.com/aiapi-favorite.ico',
])

export function normalizeSystemLogo(value: string | undefined): string {
  const logo = value?.trim()
  if (!logo || LEGACY_AIAPI114_LOGO_URLS.has(logo)) {
    return DEFAULT_LOGO
  }
  return logo
}
