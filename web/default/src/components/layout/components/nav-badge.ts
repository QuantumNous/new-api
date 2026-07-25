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
import { type NavBadgeVariant } from '../types'

export function getNavBadgeClassName(variant: NavBadgeVariant) {
  if (variant === 'promotion') {
    return 'group-data-[collapsible=icon]:hidden ml-auto shrink-0 truncate border-transparent bg-transparent px-1 py-0 text-xs font-semibold text-[#6d28d9] dark:text-[#a78bfa]'
  }

  return 'shrink-0 px-1 py-0 text-xs'
}

export function getNavItemTitleClassName(_variant?: NavBadgeVariant) {
  return 'min-w-0 flex-1 truncate'
}
