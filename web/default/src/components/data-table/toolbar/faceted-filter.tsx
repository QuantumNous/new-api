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
import type { Column } from '@tanstack/react-table'
import { Check as CheckIcon, PlusCircle as PlusCircledIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type FacetedFilterOption = {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  iconNode?: React.ReactNode
  count?: number
}

function FacetedFilterOptionIcon(props: { option: FacetedFilterOption }) {
  if (props.option.iconNode) {
    return (
      <span className='text-muted-foreground flex size-4 items-center justify-center'>
        {props.option.iconNode}
      </span>
    )
  }
  if (props.option.icon) {
    return <props.option.icon className='text-muted-foreground size-4' />
  }
  return null
}

function FacetedFilterOptionCount(props: {
  option: FacetedFilterOption
  facets?: Map<string, number>
}) {
  if (typeof props.option.count === 'number') {
    return (
      <span className='text-muted-foreground ms-auto flex h-4 min-w-4 items-center justify-center font-mono text-xs'>
        {props.option.count}
      </span>
    )
  }
  if (props.facets?.get(props.option.value)) {
    return (
      <span className='ms-auto flex h-4 w-4 items-center justify-center font-mono text-xs'>
        {props.facets.get(props.option.value)}
      </span>
    )
  }
  return null
}

type DataTableFacetedFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
    iconNode?: React.ReactNode
    count?: number
  }[]
  /** Enable single select mode (only one option can be selected at a time) */
  singleSelect?: boolean
}

function DataTableFacetedFilterInner<TData, TValue>({
  column,
  title,
  options,
  singleSelect = false,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const { t } = useTranslation()
  const facets = column?.getFacetedUniqueValues()
  const filterValue = column?.getFilterValue() as string[] | undefined
  const selectedValues = new Set(filterValue)

  const handleOptionSelect = (optionValue: string) => {
    const nextSelectedValues = getNextSelectedValues(
      selectedValues,
      optionValue,
      singleSelect
    )

    column?.setFilterValue(
      nextSelectedValues.length ? nextSelectedValues : undefined
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant='outline' size='sm' className='h-8 border-dashed' />
        }
      >
        <PlusCircledIcon className='size-4' />
        {title}
        {selectedValues?.size > 0 && (
          <>
            <Separator orientation='vertical' className='mx-2 h-4' />
            <Badge
              variant='secondary'
              className='rounded-sm px-1 font-normal lg:hidden'
            >
              {selectedValues.size}
            </Badge>
            <div className='hidden space-x-1 lg:flex'>
              {selectedValues.size > 2 ? (
                <Badge
                  variant='secondary'
                  className='rounded-sm px-1 font-normal'
                >
                  {selectedValues.size} {t('selected')}
                </Badge>
              ) : (
                options
                  .filter((option) => selectedValues.has(option.value))
                  .map((option) => (
                    <Badge
                      variant='secondary'
                      key={option.value}
                      className='rounded-sm px-1 font-normal'
                    >
                      {t(option.label)}
                    </Badge>
                  ))
              )}
            </div>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className='max-w-[360px] min-w-[200px] p-0' align='start'>
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{t('No results found.')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleOptionSelect(option.value)}
                  >
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className={cn('text-background h-4 w-4')} />
                    </div>
                    <FacetedFilterOptionIcon option={option} />
                    <span
                      className='min-w-0 flex-1 truncate'
                      title={t(option.label)}
                    >
                      {t(option.label)}
                    </span>
                    <FacetedFilterOptionCount option={option} facets={facets} />
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className='justify-center text-center'
                  >
                    {t('Clear filters')}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export const DataTableFacetedFilter = React.memo(
  DataTableFacetedFilterInner
) as typeof DataTableFacetedFilterInner

function getNextSelectedValues(
  selectedValues: Set<string>,
  optionValue: string,
  singleSelect: boolean
): string[] {
  if (singleSelect) {
    return selectedValues.has(optionValue) ? [] : [optionValue]
  }

  const nextSelectedValues = new Set(selectedValues)
  if (nextSelectedValues.has(optionValue)) {
    nextSelectedValues.delete(optionValue)
  } else {
    nextSelectedValues.add(optionValue)
  }

  return [...nextSelectedValues]
}
