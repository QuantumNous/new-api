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
import * as React from 'react'

import {
  ToggleGroup as ShadcnToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

function ToggleGroup({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof ShadcnToggleGroup>) {
  return (
    <ShadcnToggleGroup
      data-control-size={size}
      size={size}
      className={cn(
        size === 'default' &&
          "[&_[data-slot=toggle-group-item]]:h-7 [&_[data-slot=toggle-group-item]]:min-w-7 [&_[data-slot=toggle-group-item]]:text-[0.8rem] [&_[data-slot=toggle-group-item]_svg:not([class*='size-'])]:size-3.5 sm:[&_[data-slot=toggle-group-item]]:h-8 sm:[&_[data-slot=toggle-group-item]]:min-w-8 sm:[&_[data-slot=toggle-group-item]]:text-sm sm:[&_[data-slot=toggle-group-item]_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
