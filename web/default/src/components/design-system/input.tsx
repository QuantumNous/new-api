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

import { Input as ShadcnInput } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const responsiveInputSizeVariants = cva('', {
  variants: {
    size: {
      default: 'h-7 sm:h-8',
      // CTA tier matching Button size='xl' (40px -> 44px), used on auth pages.
      xl: 'h-10 px-3 sm:h-11',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

type InputSize = NonNullable<
  VariantProps<typeof responsiveInputSizeVariants>['size']
>

type InputProps = Omit<React.ComponentProps<typeof ShadcnInput>, 'size'> & {
  size?: InputSize
}

function Input({ className, size = 'default', ...props }: InputProps) {
  return (
    <ShadcnInput
      data-control-size={size}
      className={cn(responsiveInputSizeVariants({ size }), className)}
      {...props}
    />
  )
}

export { Input }
export type { InputProps, InputSize }
