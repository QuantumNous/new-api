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
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { StatusBadge, type StatusBadgeProps } from './status-badge'

type ProviderBadgeProps = Omit<StatusBadgeProps, 'children' | 'variant'> & {
  iconKey?: string | null
  label: string
}

export function ProviderBadge({
  className,
  iconKey,
  label,
  ...badgeProps
}: ProviderBadgeProps) {
  const icon = iconKey ? getLobeIcon(iconKey, 12) : null

  return (
    <StatusBadge
      {...badgeProps}
      variant='neutral'
      className={cn('shrink-0 overflow-visible', className)}
    >
      {icon && (
        <span
          data-icon='inline-start'
          className='flex items-center'
          aria-hidden='true'
        >
          {icon}
        </span>
      )}
      {label}
    </StatusBadge>
  )
}
