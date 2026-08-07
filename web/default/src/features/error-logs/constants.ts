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
import type { StatusBadgeProps } from '@/components/status-badge'
import type { ErrorCategory } from './types'

export const DEFAULT_ERROR_LOGS_DATA = {
  items: [],
  total: 0,
}

export const ERROR_CATEGORY_OPTIONS: ReadonlyArray<{
  value: ErrorCategory
  labelKey: string
  variant: StatusBadgeProps['variant']
}> = [
  { value: 'auth', labelKey: 'Auth', variant: 'orange' },
  { value: 'rate_limit', labelKey: 'Rate limit', variant: 'amber' },
  { value: 'channel', labelKey: 'Channel', variant: 'violet' },
  { value: 'validation', labelKey: 'Validation', variant: 'blue' },
  { value: 'quota', labelKey: 'Quota', variant: 'yellow' },
  { value: 'upstream', labelKey: 'Upstream error', variant: 'red' },
  { value: 'other', labelKey: 'Other', variant: 'neutral' },
] as const

export const ERROR_CATEGORY_VALUES = ERROR_CATEGORY_OPTIONS.map(
  (option) => option.value
) as [ErrorCategory, ...ErrorCategory[]]

export function getErrorCategoryConfig(category: string | undefined) {
  return (
    ERROR_CATEGORY_OPTIONS.find((option) => option.value === category) ?? {
      value: 'other' as ErrorCategory,
      labelKey: 'Other',
      variant: 'neutral' as StatusBadgeProps['variant'],
    }
  )
}
