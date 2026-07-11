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
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { Toggle as ShadcnToggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

const responsiveToggleSizeVariants = cva('', {
  variants: {
    size: {
      default:
        "h-7 min-w-7 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 sm:h-8 sm:min-w-8 sm:text-sm sm:has-data-[icon=inline-end]:pr-2 sm:has-data-[icon=inline-start]:pl-2 sm:[&_svg:not([class*='size-'])]:size-4",
      sm: null,
      lg: 'h-8 min-w-8 sm:h-9 sm:min-w-9',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

type ToggleSize = NonNullable<
  VariantProps<typeof responsiveToggleSizeVariants>['size']
>

type ToggleProps = Omit<React.ComponentProps<typeof ShadcnToggle>, 'size'> & {
  size?: ToggleSize
}

function Toggle({ className, size = 'default', ...props }: ToggleProps) {
  return (
    <ShadcnToggle
      data-control-size={size}
      size={size}
      className={cn(responsiveToggleSizeVariants({ size }), className)}
      {...props}
    />
  )
}

export { Toggle }
export type { ToggleProps, ToggleSize }
