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
// Pure helpers for the Skill package download flow, extracted from api.ts so
// they can be unit-tested without pulling in the axios client. The network
// call itself (downloadSkillPackage) stays in api.ts.
import type { MarketplaceErrorResponse } from './types'

/**
 * Stable error thrown by downloadSkillPackage so the detail page can map
 * `code` to copy. `AUTH_REQUIRED` here means web login/session failure for the
 * download action — NOT a missing runner key (that is the DR-62 runtime
 * client). Never present this as "add your key".
 */
export class DownloadSkillError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message || code)
    this.name = 'DownloadSkillError'
    this.code = code
  }
}

// Reject empty / cross-origin download URLs before they reach axios. The URL
// must come from the backend `download_cta.url` (an API-relative path); we do
// not construct it on the frontend.
export function isSafeDownloadUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  let resolved: URL
  try {
    resolved = new URL(url, window.location.origin)
  } catch {
    return false
  }
  // Same-origin only (rejects `//host`, absolute cross-origin, malformed).
  if (resolved.origin !== window.location.origin) return false
  // Must be the marketplace skill download endpoint — not an arbitrary
  // same-origin path. Uses contains+endsWith so a future `/api` prefix change
  // does not silently break it.
  return (
    resolved.pathname.includes('/marketplace/skills/') &&
    resolved.pathname.endsWith('/download')
  )
}

export function sanitizeFilename(
  name: string | undefined,
  fallback: string
): string {
  // Sanitize the fallback too, so the helper is robust even if `fallback`
  // (the slug) ever contains path separators.
  const safeFallbackBase = fallback.replace(/[/\\]/g, '').trim() || 'skill'
  const fallbackName = safeFallbackBase.endsWith('.zip')
    ? safeFallbackBase
    : `${safeFallbackBase}.zip`
  if (!name) return fallbackName
  // Strip any path separators and surrounding quotes; reject empties.
  const cleaned = name
    .replace(/^["']|["']$/g, '')
    .replace(/[/\\]/g, '')
    .trim()
  return cleaned.length > 0 ? cleaned : fallbackName
}

// Prefer RFC 5987 `filename*=` (handles non-ASCII), fall back to `filename=`.
export function filenameFromContentDisposition(
  header: string | undefined,
  fallbackSlug: string
): string {
  let raw: string | undefined
  if (header) {
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
    if (star?.[1]) {
      try {
        raw = decodeURIComponent(star[1])
      } catch {
        raw = star[1]
      }
    }
    if (!raw) {
      const plain = /filename=([^;]+)/i.exec(header)
      if (plain?.[1]) raw = plain[1].trim()
    }
  }
  return sanitizeFilename(raw, fallbackSlug)
}

// Error responses arrive as a Blob (because responseType is 'blob'); axios does
// not parse them and the global interceptor cannot read business codes. Parse
// the envelope `{ "error": { "code", "message" } }` here. Tolerate Blob /
// string / object / non-JSON / HTML bodies and fall back safely.
export async function extractDownloadError(
  data: unknown
): Promise<DownloadSkillError> {
  let text: string | undefined
  if (data instanceof Blob) {
    try {
      text = await data.text()
    } catch {
      text = undefined
    }
  } else if (typeof data === 'string') {
    text = data
  } else if (data && typeof data === 'object') {
    const obj = data as MarketplaceErrorResponse
    if (obj.error?.code) {
      return new DownloadSkillError(obj.error.code, obj.error.message)
    }
  }

  if (text) {
    try {
      const parsed = JSON.parse(text) as MarketplaceErrorResponse
      if (parsed?.error?.code) {
        return new DownloadSkillError(parsed.error.code, parsed.error.message)
      }
    } catch {
      /* non-JSON (e.g. gateway HTML) — fall through to generic */
    }
  }

  return new DownloadSkillError('DOWNLOAD_FAILED')
}
