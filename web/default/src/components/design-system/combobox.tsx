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
import { Combobox as ComboboxPrimitive } from '@base-ui/react'
import * as React from 'react'

import {
  ComboboxInput as LegacyComboboxInput,
  type ComboboxInputOption,
} from '@/components/design-system/combobox-input'
import {
  ComboboxChip,
  ComboboxChips as ShadcnComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent as ShadcnComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput as ShadcnComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'

type LegacyComboboxProps = {
  options: ComboboxInputOption[]
  value?: string
  onValueChange?: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allowCustomValue?: boolean
  className?: string
  id?: string
  openOnFocus?: boolean
}

function Combobox(props: LegacyComboboxProps): React.ReactElement
function Combobox<Value, Multiple extends boolean | undefined = false>(
  props: ComboboxPrimitive.Root.Props<Value, Multiple>
): React.ReactElement
function Combobox(
  props:
    | ComboboxPrimitive.Root.Props<unknown, boolean | undefined>
    | LegacyComboboxProps
) {
  if ('options' in props) {
    return (
      <LegacyComboboxInput
        id={props.id}
        options={props.options}
        value={props.value ?? ''}
        onValueChange={(value) => props.onValueChange?.(value)}
        placeholder={props.searchPlaceholder ?? props.placeholder}
        emptyText={props.emptyText}
        className={props.className}
        allowCustomValue={props.allowCustomValue}
        openOnFocus={props.openOnFocus}
      />
    )
  }

  return <ComboboxPrimitive.Root {...props} />
}

function ComboboxInput({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnComboboxInput>) {
  return (
    <ShadcnComboboxInput className={cn('h-7 sm:h-8', className)} {...props} />
  )
}

function ComboboxContent({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnComboboxContent>) {
  return (
    <ShadcnComboboxContent
      className={cn(
        '*:data-[slot=input-group]:h-7 sm:*:data-[slot=input-group]:h-8',
        className
      )}
      {...props}
    />
  )
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnComboboxChips>) {
  return (
    <ShadcnComboboxChips
      className={cn('min-h-7 sm:min-h-8', className)}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
}
