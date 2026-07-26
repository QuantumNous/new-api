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
const FALLBACK_RETURN_TARGET = '/dashboard'

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
}

export function normalizeReturnTarget(target?: string | null): string {
  if (!target || containsControlCharacter(target) || target.includes('\\')) {
    return FALLBACK_RETURN_TARGET
  }

  if (target.startsWith('/') && !target.startsWith('//')) {
    return target
  }

  if (typeof window === 'undefined') {
    return FALLBACK_RETURN_TARGET
  }

  try {
    const url = new URL(target)
    if (url.origin !== window.location.origin) {
      return FALLBACK_RETURN_TARGET
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return FALLBACK_RETURN_TARGET
  }
}
