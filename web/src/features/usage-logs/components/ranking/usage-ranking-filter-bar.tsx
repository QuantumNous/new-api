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
import type { Table } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { UsageRankingItem } from '../../types'
import { CompactDateTimeRangePicker } from '../compact-date-time-range-picker'
import {
  LogsFilterField,
  LogsFilterInput,
  LogsFilterToolbar,
} from '../logs-filter-toolbar'

export interface UsageRankingFilters {
  startTime: Date
  endTime: Date
  modelName: string
  channel: string
  group: string
  sortBy: 'quota' | 'request_count'
}

interface UsageRankingFilterBarProps {
  table: Table<UsageRankingItem>
  filters: UsageRankingFilters
  onChange: (filters: UsageRankingFilters) => void
  onSearch: () => void
  onReset: () => void
  searchLoading: boolean
  hasActiveFilters: boolean
}

export function UsageRankingFilterBar(props: UsageRankingFilterBarProps) {
  const { t } = useTranslation()
  const filters = props.filters
  const onChange = props.onChange
  const onSearch = props.onSearch
  const sortItems = useMemo(
    () => [
      { value: 'quota' as const, label: t('Consumed Quota') },
      { value: 'request_count' as const, label: t('Request Count') },
    ],
    [t]
  )
  const sortLabel =
    sortItems.find((item) => item.value === filters.sortBy)?.label ??
    t('Consumed Quota')

  const updateFilter = useCallback(
    <K extends keyof UsageRankingFilters>(
      key: K,
      value: UsageRankingFilters[K]
    ) => {
      onChange({ ...filters, [key]: value })
    },
    [filters, onChange]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') onSearch()
    },
    [onSearch]
  )

  const dateRangeFilter = (
    <LogsFilterField wide>
      <CompactDateTimeRangePicker
        start={props.filters.startTime}
        end={props.filters.endTime}
        onChange={(range) => {
          props.onChange({
            ...props.filters,
            startTime: range.start ?? props.filters.startTime,
            endTime: range.end ?? props.filters.endTime,
          })
        }}
      />
    </LogsFilterField>
  )
  const modelFilter = (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Model Name')}
        value={props.filters.modelName}
        onChange={(event) => updateFilter('modelName', event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  const groupFilter = (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Group')}
        value={props.filters.group}
        onChange={(event) => updateFilter('group', event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  const sortFilter = (
    <LogsFilterField>
      <Select
        items={sortItems}
        value={props.filters.sortBy}
        onValueChange={(value) => {
          if (value === 'quota' || value === 'request_count') {
            updateFilter('sortBy', value)
          }
        }}
      >
        <SelectTrigger aria-label={t('Sort By')}>
          <SelectValue>{sortLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {sortItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </LogsFilterField>
  )
  const channelFilter = (
    <LogsFilterField>
      <LogsFilterInput
        type='number'
        min={0}
        placeholder={t('Channel ID')}
        value={props.filters.channel}
        onChange={(event) => updateFilter('channel', event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )

  return (
    <LogsFilterToolbar
      table={props.table}
      primaryFilters={
        <>
          {dateRangeFilter}
          {modelFilter}
          {groupFilter}
          {sortFilter}
        </>
      }
      advancedFilters={channelFilter}
      mobilePinnedFilters={dateRangeFilter}
      mobileFilters={
        <>
          {modelFilter}
          {groupFilter}
          {sortFilter}
          {channelFilter}
        </>
      }
      mobileFilterCount={
        [
          props.filters.modelName,
          props.filters.group,
          props.filters.channel,
          props.filters.sortBy !== 'quota',
        ].filter(Boolean).length
      }
      hasAdvancedActiveFilters={Boolean(props.filters.channel)}
      advancedFilterCount={props.filters.channel ? 1 : 0}
      hasActiveFilters={props.hasActiveFilters}
      onSearch={props.onSearch}
      searchLoading={props.searchLoading}
      onReset={props.onReset}
    />
  )
}
