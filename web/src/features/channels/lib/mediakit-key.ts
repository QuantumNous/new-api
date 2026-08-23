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
export const DEFAULT_MEDIAKIT_BASE_URL = 'https://amk.cn-beijing.volces.com'

export type MediaKitCredentials = {
  ark_api_key: string
  mediakit_api_key: string
}

export function composeMediaKitKey(arkAPIKey: string, mediaKitAPIKey: string) {
  return JSON.stringify({
    ark_api_key: arkAPIKey.trim(),
    mediakit_api_key: mediaKitAPIKey.trim(),
  })
}

export function parseMediaKitKey(
  raw: string | null | undefined
): MediaKitCredentials | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const arkAPIKey = String(parsed.ark_api_key ?? '').trim()
      const mediaKitAPIKey = String(parsed.mediakit_api_key ?? '').trim()
      if (!arkAPIKey || !mediaKitAPIKey) return null
      return { ark_api_key: arkAPIKey, mediakit_api_key: mediaKitAPIKey }
    } catch {
      return null
    }
  }

  const separator = trimmed.indexOf('|')
  if (separator <= 0 || separator === trimmed.length - 1) return null
  const arkAPIKey = trimmed.slice(0, separator).trim()
  const mediaKitAPIKey = trimmed.slice(separator + 1).trim()
  if (!arkAPIKey || !mediaKitAPIKey) return null
  return { ark_api_key: arkAPIKey, mediakit_api_key: mediaKitAPIKey }
}
