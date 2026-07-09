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
import { useEffect, useState, type ReactNode } from 'react'
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
import { getEnabledModels } from '@/features/channels/api'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { getDefaultBillingTimeRange } from '../lib/utils'
import type { BillingSummaryFilters } from '../types'

const SUGGEST_MAX = 8

function getSuggestions(key: string): string[] {
  try {
    const raw = localStorage.getItem(`billing_summary_suggest_${key}`)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveSuggestion(key: string, value: string) {
  if (!value.trim()) return
  try {
    const prev = getSuggestions(key).filter((v) => v !== value)
    localStorage.setItem(
      `billing_summary_suggest_${key}`,
      JSON.stringify([value, ...prev].slice(0, SUGGEST_MAX))
    )
  } catch {
    /* localStorage unavailable */
  }
}

interface SuggestInputProps extends React.ComponentProps<typeof Input> {
  suggestKey: string
}

function SuggestInput({ suggestKey, ...props }: SuggestInputProps) {
  const listId = `billing-suggest-list-${suggestKey}`
  const suggestions = getSuggestions(suggestKey)
  return (
    <>
      <Input list={listId} {...props} />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
    </>
  )
}

interface BillingSummaryFilterBarProps<TData> {
  table: Table<TData>
  onApply: (filters: BillingSummaryFilters) => void
  isFetching?: boolean
}

export function BillingSummaryFilterBar<TData>({
  table,
  onApply,
  isFetching,
}: BillingSummaryFilterBarProps<TData>) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<BillingSummaryFilters>(() => {
    const { start, end } = getDefaultBillingTimeRange()
    return { startTime: start, endTime: end }
  })
  const [enabledModels, setEnabledModels] = useState<string[]>([])

  useEffect(() => {
    getEnabledModels()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setEnabledModels(res.data.sort())
        }
      })
      .catch(() => {
        /* fallback to text input if fetch fails */
      })
  }, [])

  const handleChange = (
    field: keyof BillingSummaryFilters,
    value: Date | string | undefined
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleApply = () => {
    if (filters.token) saveSuggestion('token', filters.token)
    if (filters.username) saveSuggestion('username', filters.username)
    if (filters.email) saveSuggestion('email', filters.email)
    if (filters.channel) saveSuggestion('channel', filters.channel)
    onApply(filters)
  }

  const handleReset = () => {
    const { start, end } = getDefaultBillingTimeRange()
    const resetFilters: BillingSummaryFilters = { startTime: start, endTime: end }
    setFilters(resetFilters)
    onApply(resetFilters)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleApply()
  }

  const inputClass = 'w-full sm:w-[160px]'

  const hasExpandedFilters =
    !!filters.token || !!filters.username || !!filters.email || !!filters.channel

  const modelSelect: ReactNode =
    enabledModels.length > 0 ? (
      <Select
        value={filters.model || ''}
        onValueChange={(value) =>
          handleChange('model', value === 'all' ? undefined : (value ?? undefined))
        }
      >
        <SelectTrigger className={inputClass}>
          <SelectValue placeholder={t('Model Name')} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectItem value='all'>{t('All Models')}</SelectItem>
            {enabledModels.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    ) : (
      <Input
        placeholder={t('Model Name')}
        value={filters.model || ''}
        onChange={(e) => handleChange('model', e.target.value)}
        onKeyDown={handleKeyDown}
        className={inputClass}
      />
    )

  return (
    <DataTableToolbar
      table={table}
      initialExpanded={true}
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
      additionalSearch={modelSelect}
      expandable={
        <>
          <SuggestInput
            suggestKey='token'
            placeholder={t('Token Name')}
            value={filters.token || ''}
            onChange={(e) => handleChange('token', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <SuggestInput
            suggestKey='username'
            placeholder={t('Username')}
            value={filters.username || ''}
            onChange={(e) => handleChange('username', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <SuggestInput
            suggestKey='email'
            placeholder={t('Email')}
            value={filters.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <SuggestInput
            suggestKey='channel'
            placeholder={t('Channel ID')}
            value={filters.channel || ''}
            onChange={(e) => handleChange('channel', e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
        </>
      }
      hasExpandedActiveFilters={hasExpandedFilters}
      hasAdditionalFilters={!!filters.model || hasExpandedFilters}
      onSearch={handleApply}
      searchLoading={isFetching}
      onReset={handleReset}
      hideViewOptions
    />
  )
}
