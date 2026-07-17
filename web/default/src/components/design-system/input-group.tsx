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
  InputGroup as ShadcnInputGroup,
  InputGroupAddon,
  InputGroupButton as ShadcnInputGroupButton,
  InputGroupInput as ShadcnInputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

function InputGroup({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnInputGroup>) {
  return (
    <ShadcnInputGroup
      data-control-size='default'
      className={cn('h-7 sm:h-8', className)}
      {...props}
    />
  )
}

function InputGroupButton({
  className,
  size = 'xs',
  ...props
}: React.ComponentProps<typeof ShadcnInputGroupButton>) {
  return (
    <ShadcnInputGroupButton
      data-control-size={size}
      size={size}
      className={cn(
        size === 'sm' && 'h-7 sm:h-8',
        size === 'icon-sm' && 'size-7 sm:size-8',
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnInputGroupInput>) {
  return (
    <ShadcnInputGroupInput className={cn('h-full', className)} {...props} />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
}
