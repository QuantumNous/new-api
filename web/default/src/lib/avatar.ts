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
import type { CSSProperties } from 'react'

export type UserAvatarStyle = Pick<CSSProperties, 'backgroundImage' | 'color'>

/*
 * Curated duotone gradients (avatar.vercel.sh style). A raw hash-to-hue
 * mapping lands on murky olive/mustard tones for many names; a hand-picked
 * palette keeps every user identity vivid and readable (white initial) in
 * both light and dark themes.
 */
const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#4f46e5', '#7c3aed'], // indigo -> violet
  ['#2563eb', '#0891b2'], // blue -> cyan
  ['#7c3aed', '#db2777'], // violet -> pink
  ['#e11d48', '#ea580c'], // rose -> orange
  ['#059669', '#0d9488'], // emerald -> teal
  ['#0284c7', '#4f46e5'], // sky -> indigo
  ['#db2777', '#e11d48'], // pink -> rose
  ['#0d9488', '#0284c7'], // teal -> sky
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getUserAvatarStyle(name: string): UserAvatarStyle {
  const [from, to] =
    AVATAR_GRADIENTS[hashString(name) % AVATAR_GRADIENTS.length]

  return {
    backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    color: 'white',
  }
}

export function getUserAvatarFallback(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}
