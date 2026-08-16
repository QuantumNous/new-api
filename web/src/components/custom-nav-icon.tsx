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
import { Link2 } from 'lucide-react'
import type { ElementType } from 'react'
import type { IconBaseProps } from 'react-icons'

import { ReactIconByName } from '@/components/react-icon-by-name'

const ICON_CACHE = new Map<string, ElementType>()

/**
 * Stable icon component for an admin-provided react-icons name, so sidebar
 * items keep the same component identity between renders. Falls back to a
 * generic link icon when no name is configured.
 */
export function getCustomNavIcon(name: string): ElementType {
  const trimmed = name.trim()
  if (!trimmed) return Link2

  const cached = ICON_CACHE.get(trimmed)
  if (cached) return cached

  function CustomNavIcon(props: IconBaseProps) {
    return <ReactIconByName name={trimmed} {...props} />
  }

  ICON_CACHE.set(trimmed, CustomNavIcon)
  return CustomNavIcon
}
