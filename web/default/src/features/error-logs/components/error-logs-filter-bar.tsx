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
import { useCallback, useEffect, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { type Table } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTableToolbar } from '@/components/data-table'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { ERROR_CATEGORY_OPTIONS, ERROR_CATEGORY_VALUES } from '../constants'
import { buildSearchParams, getDefaultTimeRange } from '../lib/utils'
import type { ErrorCategory, ErrorLogFilters } from '../types'

const route = getRouteApi('/_authenticated/error-logs/')

function isErrorCategory(value: string): value is ErrorCategory {
  return (ERROR_CATEGORY_VALUES as readonly string[]).includes(value)
}

interface ErrorLogsFilterBarProps<TData> {
  table: Table<TData>
}

export function ErrorLogsFilterBar<TData>(
  props: ErrorLogsFilterBarProps<TData>
) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchParams = route.useSearch()
  const fetchingLogs = useIsFetching({ queryKey: ['error-logs'] })

  const [filters, setFilters] = useState<ErrorLogFilters>(() => {
    const { start, end } = getDefaultTimeRange()
    return { startTime: start, endTime: end, errorCategory: '' }
  })

  useEffect(() => {
    const next: Partial<ErrorLogFilters> = {}
    if (searchParams.startTime)
      next.startTime = new Date(searchParams.startTime)
    if (searchParams.endTime) next.endTime = new Date(searchParams.endTime)
    if (searchParams.errorCategory)
      next.errorCategory = searchParams.errorCategory
    if (searchParams.username) next.username = searchParams.username
    if (searchParams.model) next.model = searchParams.model
    if (searchParams.channel) next.channel = String(searchParams.channel)
    if (searchParams.token) next.token = searchParams.token
    if (searchParams.requestId) next.requestId = searchParams.requestId
    if (searchParams.keyword) next.keyword = searchParams.keyword

    if (Object.keys(next).length > 0) {
      setFilters((prev) => ({ ...prev, ...next }))
    }
  }, [
    searchParams.startTime,
    searchParams.endTime,
    searchParams.errorCategory,
    searchParams.username,
    searchParams.model,
    searchParams.channel,
    searchParams.token,
    searchParams.requestId,
    searchParams.keyword,
  ])

  const handleChange = useCallback(
    (field: keyof ErrorLogFilters, value: Date | string | undefined) => {
      setFilters((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleApply = useCallback(() => {
    navigate({
      to: '/error-logs',
      search: {
        ...buildSearchParams(filters),
        page: 1,
      },
    })
    queryClient.invalidateQueries({ queryKey: ['error-logs'] })
  }, [filters, navigate, queryClient])

  const handleReset = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    const resetFilters: ErrorLogFilters = {
      startTime: start,
      endTime: end,
      errorCategory: '',
    }
    setFilters(resetFilters)
    navigate({
      to: '/error-logs',
      search: {
        page: 1,
        startTime: start.getTime(),
        endTime: end.getTime(),
      },
    })
    queryClient.invalidateQueries({ queryKey: ['error-logs'] })
  }, [navigate, queryClient])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApply()
    },
    [handleApply]
  )

  const hasExpandedFilters =
    !!filters.token ||
    !!filters.channel ||
    !!filters.requestId ||
    !!filters.keyword

  const hasAdditionalFilters =
    !!filters.username ||
    !!filters.model ||
    !!filters.errorCategory ||
    hasExpandedFilters

  const inputClass = 'w-full sm:w-[140px] lg:w-[160px]'

  return (
    <DataTableToolbar
      table={props.table}
      customSearch={
        <CompactDateTimeRangePicker
          start={filters.startTime}
          end={filters.endTime}
          onChange={({ start, end }) => {
            handleChange('startTime', start)
            handleChange('endTime', end)
          }}
          className='w-full sm:w-[340px]'
        />
      }
      additionalSearch={
        <>
          <Select
            items={[
              { value: 'all', label: t('All Categories') },
              ...ERROR_CATEGORY_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              })),
            ]}
            value={filters.errorCategory || ''}
            onValueChange={(value) => {
              handleChange(
                'errorCategory',
                value !== null && isErrorCategory(value) ? value : ''
              )
            }}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder={t('All Categories')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='all'>{t('All Categories')}</SelectItem>
                {ERROR_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            placeholder={t('Username')}
            value={filters.username || ''}
            onChange={(e) => handleChange('username', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <Input
            placeholder={t('Model Name')}
            value={filters.model || ''}
            onChange={(e) => handleChange('model', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
        </>
      }
      expandable={
        <>
          <Input
            placeholder={t('Channel ID')}
            value={filters.channel || ''}
            onChange={(e) => handleChange('channel', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <Input
            placeholder={t('Token Name')}
            value={filters.token || ''}
            onChange={(e) => handleChange('token', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <Input
            placeholder={t('Request ID')}
            value={filters.requestId || ''}
            onChange={(e) => handleChange('requestId', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <Input
            placeholder={t('Keyword')}
            value={filters.keyword || ''}
            onChange={(e) => handleChange('keyword', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
        </>
      }
      hasExpandedActiveFilters={hasExpandedFilters}
      hasAdditionalFilters={hasAdditionalFilters}
      onSearch={handleApply}
      searchLoading={fetchingLogs > 0}
      onReset={handleReset}
    />
  )
}
