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

export interface LoadedMediaUrl {
  url: string
  revoke: boolean
}

function isDirectMediaUrl(url: string): boolean {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  )
}

function isProxiedMediaUrl(url: string): boolean {
  const trimmed = url.trim()
  if (
    trimmed.startsWith('/v1/videos/') ||
    trimmed.startsWith('/v1/images/')
  ) {
    return true
  }
  try {
    const parsed = new URL(trimmed, window.location.origin)
    return (
      parsed.pathname.startsWith('/v1/videos/') ||
      parsed.pathname.startsWith('/v1/images/')
    )
  } catch {
    return false
  }
}

export async function loadAuthenticatedMediaUrl(
  url: string
): Promise<LoadedMediaUrl> {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error('empty media url')
  }

  if (isDirectMediaUrl(trimmed) && !isProxiedMediaUrl(trimmed)) {
    return { url: trimmed, revoke: false }
  }

  const res = await fetch(trimmed, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`media fetch failed: ${res.status}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    throw new Error('media fetch returned error payload')
  }

  const blob = await res.blob()
  return { url: URL.createObjectURL(blob), revoke: true }
}
