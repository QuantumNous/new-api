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

import { Button as ShadcnButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const responsiveButtonSizeVariants = cva('', {
  variants: {
    size: {
      default:
        "h-7 gap-1 px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5 sm:h-8 sm:gap-1.5 sm:text-sm sm:has-data-[icon=inline-end]:pr-2 sm:has-data-[icon=inline-start]:pl-2 sm:[&_svg:not([class*='size-'])]:size-4",
      xs: null,
      sm: null,
      lg: 'h-8 sm:h-9',
      xl: 'h-10 gap-2 px-4 sm:h-11 sm:px-5',
      icon: 'size-7 sm:size-8',
      'icon-xs': null,
      'icon-sm': null,
      'icon-lg': 'size-8 sm:size-9',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

type ButtonSize = NonNullable<
  VariantProps<typeof responsiveButtonSizeVariants>['size']
>

type ButtonProps = Omit<React.ComponentProps<typeof ShadcnButton>, 'size'> & {
  size?: ButtonSize
}

function Button({ className, size = 'default', ...props }: ButtonProps) {
  return (
    <ShadcnButton
      data-control-size={size}
      size={size === 'xl' ? 'lg' : size}
      className={cn(responsiveButtonSizeVariants({ size }), className)}
      {...props}
    />
  )
}

export { Button }
export type { ButtonProps, ButtonSize }
