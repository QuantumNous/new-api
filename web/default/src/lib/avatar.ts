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

import { getIdentityTextColorClass } from '@/lib/colors'

export interface UserAvatarProps {
  className: string
  style: CSSProperties
}

/**
 * Soft identity tint (Linear/Notion style): a low-opacity wash of the user's
 * stable identity hue, the initial in the full-strength hue, and a faint
 * matching inner ring. The class sets the identity text color and the inline
 * style derives background/ring from `currentColor` with the same mix ratios
 * as identity badges, so avatars match group/model badges and adapt to
 * light/dark themes automatically. Inline styles also win over the fallback's
 * default `bg-muted` deterministically.
 */
export function getUserAvatarProps(name: string): UserAvatarProps {
  return {
    className: getIdentityTextColorClass(name),
    style: {
      backgroundColor:
        'color-mix(in oklch, currentColor var(--identity-surface-mix), transparent)',
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, currentColor var(--identity-border-mix), transparent)',
    },
  }
}

export function getUserAvatarFallback(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}
