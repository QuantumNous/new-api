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

/**
 * Allow only same-app relative paths after login.
 * Blocks open redirects: //evil, https://evil, javascript:, etc.
 */
export function safeRedirect(
  path: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!path || typeof path !== 'string') return fallback
  let value = path.trim()
  if (!value) return fallback

  const hasUnsafeSyntax = (candidate: string): boolean => {
    let decoded = candidate
    const containsUnsafePathCharacter = (input: string): boolean => {
      if (input.includes('\\')) return true
      for (const character of input) {
        const codePoint = character.codePointAt(0) ?? 0
        if (codePoint <= 0x1f || codePoint === 0x7f) return true
      }
      return false
    }
    for (let i = 0; i < 2; i += 1) {
      if (decoded.startsWith('//')) return true
      if (containsUnsafePathCharacter(decoded)) return true
      try {
        const next = decodeURIComponent(decoded)
        if (next === decoded) break
        decoded = next
      } catch {
        return true
      }
    }
    return decoded.startsWith('//') || containsUnsafePathCharacter(decoded)
  }

  if (hasUnsafeSyntax(value)) return fallback

  // Absolute URL → keep pathname+search+hash if same origin, else fallback
  try {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value) || value.startsWith('//')) {
      if (typeof window !== 'undefined') {
        const url = new URL(value, window.location.origin)
        if (url.origin !== window.location.origin) return fallback
        value = `${url.pathname}${url.search}${url.hash}`
      } else {
        return fallback
      }
    }
  } catch {
    return fallback
  }

  if (hasUnsafeSyntax(value)) return fallback

  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.toLowerCase().includes('javascript:')) return fallback
  return value
}
