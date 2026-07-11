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
import { Check as CheckIcon, ChevronDown } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/design-system/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DataTableFacetedFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
    icon?: ComponentType<{ className?: string }>
    iconNode?: ReactNode
    count?: number
  }[]
  /** Enable single select mode (only one option can be selected at a time) */
  singleSelect?: boolean
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  singleSelect = false,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const { t } = useTranslation()
  const facets = column?.getFacetedUniqueValues()
  const filterValue = column?.getFilterValue() as string[] | undefined
  const selectedValues = new Set(filterValue)
  const resolvedTitle = title ?? t('Filter')
  const selectedOptions = options.filter((option) =>
    selectedValues.has(option.value)
  )

  let selectedSummary: string | null = null
  if (selectedValues.size === 1 && selectedOptions.length === 1) {
    selectedSummary = t(selectedOptions[0].label)
  } else if (selectedValues.size === 2 && selectedOptions.length === 2) {
    selectedSummary = selectedOptions
      .map((option) => t(option.label))
      .join(', ')
  } else if (selectedValues.size > 0) {
    selectedSummary = `${selectedValues.size} ${t('selected')}`
  }

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
          <Button
            variant='outline'
            className='w-full min-w-0 justify-start font-normal'
            aria-label={
              selectedSummary
                ? `${resolvedTitle}: ${selectedSummary}`
                : resolvedTitle
            }
          />
        }
      >
        <span className='text-muted-foreground min-w-0 truncate text-left'>
          {resolvedTitle}
        </span>
        {selectedSummary && (
          <>
            <span className='text-muted-foreground' aria-hidden='true'>
              :
            </span>
            <span className='text-foreground min-w-0 flex-1 truncate text-left'>
              {selectedSummary}
            </span>
          </>
        )}
        <ChevronDown className='text-muted-foreground ms-auto size-3.5 shrink-0 transition-transform duration-150 group-data-[popup-open]/button:rotate-180' />
      </PopoverTrigger>
      <PopoverContent
        className='w-(--anchor-width) max-w-[360px] min-w-52 p-0'
        align='start'
      >
        <Command>
          <CommandInput
            placeholder={resolvedTitle}
            aria-label={resolvedTitle}
          />
          <CommandList>
            <CommandEmpty>{t('No results found.')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                let optionIcon: ReactNode = null
                if (option.iconNode) {
                  optionIcon = (
                    <span className='text-muted-foreground flex size-4 items-center justify-center'>
                      {option.iconNode}
                    </span>
                  )
                } else if (option.icon) {
                  optionIcon = (
                    <option.icon className='text-muted-foreground size-4' />
                  )
                }

                const optionCount =
                  typeof option.count === 'number'
                    ? option.count
                    : facets?.get(option.value)

                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleOptionSelect(option.value)}
                    aria-selected={isSelected}
                  >
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon
                        className={cn('text-background h-4 w-4')}
                        aria-hidden='true'
                      />
                    </div>
                    {optionIcon}
                    <span
                      className='min-w-0 flex-1 truncate'
                      title={t(option.label)}
                    >
                      {t(option.label)}
                    </span>
                    {optionCount != null && (
                      <span className='text-muted-foreground ms-auto flex h-4 min-w-4 items-center justify-center text-xs tabular-nums'>
                        {optionCount}
                      </span>
                    )}
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
