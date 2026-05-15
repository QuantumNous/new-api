/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export const LANGUAGE_REGION_PROMPT_DISMISSED_KEY =
  'language-region-prompt-dismissed'

export const SUPPORTED_LANGUAGES = ['en', 'zh', 'fr', 'ru', 'ja', 'vi'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export type RegionalPromptLanguage = Exclude<SupportedLanguage, 'en'>

const REGION_LANGUAGE_MAP: Record<string, RegionalPromptLanguage> = {
  CN: 'zh',
  HK: 'zh',
  MO: 'zh',
  TW: 'zh',
  FR: 'fr',
  GF: 'fr',
  GP: 'fr',
  MC: 'fr',
  MQ: 'fr',
  NC: 'fr',
  PF: 'fr',
  PM: 'fr',
  RE: 'fr',
  WF: 'fr',
  JP: 'ja',
  RU: 'ru',
  VN: 'vi',
}

const TIME_ZONE_LANGUAGE_MAP: Record<string, RegionalPromptLanguage> = {
  'Asia/Shanghai': 'zh',
  'Asia/Hong_Kong': 'zh',
  'Asia/Macau': 'zh',
  'Asia/Taipei': 'zh',
  'Asia/Tokyo': 'ja',
  'Asia/Ho_Chi_Minh': 'vi',
  'Europe/Moscow': 'ru',
  'Europe/Paris': 'fr',
}

export function normalizeSupportedLanguage(
  value?: string | null
): SupportedLanguage | undefined {
  if (!value) return undefined

  const normalized = value.trim().replace(/_/g, '-').toLowerCase()
  if (!normalized) return undefined
  if (normalized.startsWith('zh')) return 'zh'

  const language = normalized.split('-')[0]
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? (language as SupportedLanguage)
    : undefined
}

function detectRegionFromLocale(value?: string | null): RegionalPromptLanguage | undefined {
  if (!value) return undefined

  const normalized = value.trim().replace(/_/g, '-')
  const region = normalized
    .split('-')
    .find((part) => /^[A-Za-z]{2}$/.test(part))
    ?.toUpperCase()

  return region ? REGION_LANGUAGE_MAP[region] : undefined
}

export function detectRegionalPromptLanguage(): RegionalPromptLanguage | undefined {
  if (typeof navigator !== 'undefined') {
    const candidates = [
      ...(navigator.languages ?? []),
      navigator.language,
    ].filter(Boolean)

    for (const language of candidates) {
      const detectedLanguage = normalizeSupportedLanguage(language)
      if (detectedLanguage && detectedLanguage !== 'en') {
        return detectedLanguage
      }

      const detectedRegion = detectRegionFromLocale(language)
      if (detectedRegion) return detectedRegion
    }
  }

  if (typeof Intl === 'undefined') return undefined

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return timeZone ? TIME_ZONE_LANGUAGE_MAP[timeZone] : undefined
}
