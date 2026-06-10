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
import type { ColumnFiltersState, OnChangeFn } from '@tanstack/react-table'
import { useDebounce } from '@/hooks/use-debounce'

type UseDebouncedColumnFilterOptions = {
  columnFilters: ColumnFiltersState
  columnId: string
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  delay?: number
}

export function useDebouncedColumnFilter({
  columnFilters,
  columnId,
  onColumnFiltersChange,
  delay = 500,
}: UseDebouncedColumnFilterOptions) {
  const value =
    (columnFilters.find((filter) => filter.id === columnId)?.value as
      | string
      | undefined) ?? ''
  const [inputValue, setInputValue] = React.useState(value)
  const debouncedValue = useDebounce(inputValue, delay)

  React.useEffect(() => {
    // Keep the input aligned when URL state changes outside the local field.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value)
  }, [value])

  React.useEffect(() => {
    if (debouncedValue === value) return

    onColumnFiltersChange((previous) => {
      const filters = previous.filter((filter) => filter.id !== columnId)
      return debouncedValue
        ? [...filters, { id: columnId, value: debouncedValue }]
        : filters
    })
  }, [columnId, debouncedValue, onColumnFiltersChange, value])

  return {
    value,
    inputValue,
    setInputValue,
  }
}
