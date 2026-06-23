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
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useQuery,
  useQueryClient,
  useIsFetching,
} from '@tanstack/react-query'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import { type Table } from '@tanstack/react-table'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useIsAdmin, useIsRoot } from '@/hooks/use-admin'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LOG_TYPE_ALL_VALUE, LOG_TYPE_FILTERS } from '../constants'
import { getGroups } from '../api'
import { buildSearchParams } from '../lib/filter'
import { getDefaultTimeRange } from '../lib/utils'
import type { CommonLogFilters } from '../types'
import { CommonLogsStats } from './common-logs-stats'
import { CompactDateTimeRangePicker } from './compact-date-time-range-picker'
import {
  LogsFilterField,
  LogsFilterInput,
  LogsFilterToolbar,
} from './logs-filter-toolbar'
import { useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')
const logTypeValues = ['0', '1', '2', '3', '4', '5', '6'] as const

type LogTypeValue = (typeof logTypeValues)[number]

function isLogTypeValue(value: string): value is LogTypeValue {
  return (logTypeValues as readonly string[]).includes(value)
}

interface CommonLogsFilterBarProps<TData> {
  table: Table<TData>
}

export function CommonLogsFilterBar<TData>(
  props: CommonLogsFilterBarProps<TData>
) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchParams = route.useSearch()
  const isAdmin = useIsAdmin()
  const isRoot = useIsRoot()
  const { sensitiveVisible, setSensitiveVisible } = useUsageLogsContext()
  const fetchingLogs = useIsFetching({ queryKey: ['logs'] })

  // Group filter is admin-only — its option source `/api/group/` is behind
  // AdminAuth — so only fetch the group list for admins.
  const { data: groupsResp } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  })
  const groupOptions = useMemo(
    () => (groupsResp?.success ? (groupsResp.data ?? []) : []),
    [groupsResp]
  )

  const [filters, setFilters] = useState<CommonLogFilters>(() => {
    const { start, end } = getDefaultTimeRange()
    return { startTime: start, endTime: end }
  })
  const [logType, setLogType] = useState<LogTypeValue>(LOG_TYPE_ALL_VALUE)

  useEffect(() => {
    const { start, end } = getDefaultTimeRange()
    setFilters({
      startTime: searchParams.startTime
        ? new Date(searchParams.startTime)
        : start,
      endTime: searchParams.endTime ? new Date(searchParams.endTime) : end,
      channel: searchParams.channel || undefined,
      model: searchParams.model || undefined,
      token: searchParams.token || undefined,
      // Group filter is admin-only; ignore any group in the URL for non-admins
      // so a stale/hand-edited ?group= can't silently filter /api/log/self with
      // no visible control and a disabled Reset.
      group: isAdmin ? searchParams.group || undefined : undefined,
      username: searchParams.username || undefined,
      requestId: searchParams.requestId || undefined,
      upstreamRequestId: searchParams.upstreamRequestId || undefined,
      nonAdmin: searchParams.nonAdmin || undefined,
    })

    const typeArr = searchParams.type
    const nextLogType =
      Array.isArray(typeArr) &&
      typeArr.length === 1 &&
      isLogTypeValue(typeArr[0])
        ? typeArr[0]
        : LOG_TYPE_ALL_VALUE
    setLogType(nextLogType)
  }, [
    searchParams.startTime,
    searchParams.endTime,
    searchParams.channel,
    searchParams.model,
    searchParams.token,
    searchParams.group,
    searchParams.username,
    searchParams.requestId,
    searchParams.upstreamRequestId,
    searchParams.nonAdmin,
    searchParams.type,
    isAdmin,
  ])

  const handleChange = useCallback(
    (field: keyof CommonLogFilters, value: Date | string | boolean | undefined) => {
      setFilters((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleApply = useCallback(() => {
    const filterParams = buildSearchParams(filters, 'common')
    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: {
        ...filterParams,
        type: [logType],
        page: 1,
      },
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }, [filters, logType, navigate, queryClient])

  const handleReset = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    const resetFilters: CommonLogFilters = { startTime: start, endTime: end }
    setFilters(resetFilters)
    setLogType(LOG_TYPE_ALL_VALUE)

    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: {
        page: 1,
        type: [LOG_TYPE_ALL_VALUE],
        startTime: start.getTime(),
        endTime: end.getTime(),
      },
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }, [navigate, queryClient])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApply()
    },
    [handleApply]
  )

  const hasExpandedFilters =
    !!filters.token ||
    !!filters.username ||
    !!filters.channel ||
    !!filters.requestId ||
    !!filters.upstreamRequestId ||
    !!filters.nonAdmin

  const hasTypeFilter = logType !== LOG_TYPE_ALL_VALUE
  // PLG (non-enterprise) users don't see the group concept, so the group
  // filter and its active-filter badge are hidden for them.
  // Group filter is admin-only (see groupFilter), so its active-filter badge
  // keys off isAdmin to stay consistent with control visibility.
  const hasGroupFilter = isAdmin && !!filters.group
  const hasAdditionalFilters =
    !!filters.model || hasGroupFilter || hasTypeFilter || hasExpandedFilters

  const expandedFilterCount = [
    filters.token,
    isAdmin ? filters.username : undefined,
    isAdmin ? filters.channel : undefined,
    filters.requestId,
    filters.upstreamRequestId,
    isRoot ? filters.nonAdmin : undefined,
  ].filter(Boolean).length
  const sensitiveType = sensitiveVisible ? 'text' : 'password'
  const logTypeItems = useMemo(
    () =>
      LOG_TYPE_FILTERS.map((type) => ({
        value: type.value,
        label: t(type.label),
      })),
    [t]
  )
  const logTypeLabel =
    logTypeItems.find((type) => type.value === logType)?.label ?? t('All Types')

  const statsBar = (
    <div className='flex flex-wrap items-center gap-2'>
      <CommonLogsStats />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setSensitiveVisible(!sensitiveVisible)}
              aria-label={sensitiveVisible ? t('Hide') : t('Show')}
              className='text-muted-foreground hover:text-foreground size-7'
            />
          }
        >
          {sensitiveVisible ? <Eye /> : <EyeOff />}
        </TooltipTrigger>
        <TooltipContent>
          {sensitiveVisible ? t('Hide') : t('Show')}
        </TooltipContent>
      </Tooltip>
    </div>
  )

  const dateRangeFilter = (
    <LogsFilterField wide>
      <CompactDateTimeRangePicker
        start={filters.startTime}
        end={filters.endTime}
        onChange={({ start, end }) => {
          handleChange('startTime', start)
          handleChange('endTime', end)
        }}
      />
    </LogsFilterField>
  )
  const modelFilter = (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Model Name')}
        value={filters.model || ''}
        onChange={(e) => handleChange('model', e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  // Group filter is admin-only: the option source `/api/group/` is behind
  // AdminAuth, and group filtering of logs is an admin capability. allowCustomValue
  // lets an admin still type a renamed/deleted historical group that no longer
  // appears in the current ratio-group config (log `group` is a point-in-time
  // snapshot and is never backfilled).
  const groupComboboxOptions = useMemo(
    () => groupOptions.map((g) => ({ value: g, label: g })),
    [groupOptions]
  )
  const groupFilter = isAdmin ? (
    <LogsFilterField>
      {sensitiveVisible ? (
        <Combobox
          options={groupComboboxOptions}
          value={filters.group || ''}
          onValueChange={(value) => handleChange('group', value || undefined)}
          placeholder={t('Group')}
          searchPlaceholder={t('Group')}
          emptyText={t('No group found.')}
          allowCustomValue
        />
      ) : (
        // Consistent with the channel/group columns: when sensitive info is
        // hidden, group names are masked. Show a read-only masked placeholder
        // (preserving whether a group filter is active) instead of exposing
        // names in the combobox value/options.
        <LogsFilterInput
          readOnly
          value={filters.group ? '••••' : ''}
          placeholder={t('Group')}
          aria-label={t('Group')}
        />
      )}
    </LogsFilterField>
  ) : null
  const typeFilter = (
    <LogsFilterField>
      <Select
        items={logTypeItems}
        value={logType}
        onValueChange={(value) => {
          setLogType(
            value !== null && isLogTypeValue(value) ? value : LOG_TYPE_ALL_VALUE
          )
        }}
      >
        <SelectTrigger>
          <SelectValue>{logTypeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {LOG_TYPE_FILTERS.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {t(type.label)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </LogsFilterField>
  )
  const advancedFilters = (
    <>
      <LogsFilterField>
        <LogsFilterInput
          placeholder={t('Token Name')}
          type={sensitiveType}
          value={filters.token || ''}
          onChange={(e) => handleChange('token', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </LogsFilterField>
      {isAdmin && (
        <LogsFilterField>
          <LogsFilterInput
            placeholder={t('Username')}
            type={sensitiveType}
            value={filters.username || ''}
            onChange={(e) => handleChange('username', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </LogsFilterField>
      )}
      {isAdmin && (
        <LogsFilterField>
          <LogsFilterInput
            placeholder={t('Channel ID')}
            value={filters.channel || ''}
            onChange={(e) => handleChange('channel', e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </LogsFilterField>
      )}
      {isRoot && (
        <LogsFilterField>
          <label className='flex h-full cursor-pointer items-center gap-2 px-1 text-sm whitespace-nowrap select-none'>
            <Switch
              checked={!!filters.nonAdmin}
              onCheckedChange={(checked) => handleChange('nonAdmin', checked)}
            />
            <span className='text-muted-foreground'>plg user</span>
          </label>
        </LogsFilterField>
      )}
      <LogsFilterField>
        <LogsFilterInput
          placeholder={t('Request ID')}
          value={filters.requestId || ''}
          onChange={(e) => handleChange('requestId', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </LogsFilterField>
      <LogsFilterField>
        <LogsFilterInput
          placeholder={t('Upstream Request ID')}
          value={filters.upstreamRequestId || ''}
          onChange={(e) => handleChange('upstreamRequestId', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </LogsFilterField>
    </>
  )

  return (
    <LogsFilterToolbar
      table={props.table}
      stats={statsBar}
      primaryFilters={
        <>
          {dateRangeFilter}
          {modelFilter}
          {groupFilter}
          {typeFilter}
        </>
      }
      advancedFilters={advancedFilters}
      mobilePinnedFilters={dateRangeFilter}
      mobileFilters={
        <>
          {modelFilter}
          {groupFilter}
          {typeFilter}
          {advancedFilters}
        </>
      }
      mobileFilterCount={
        [filters.model, hasGroupFilter, hasTypeFilter].filter(Boolean).length +
        expandedFilterCount
      }
      hasAdvancedActiveFilters={hasExpandedFilters}
      advancedFilterCount={expandedFilterCount}
      hasActiveFilters={hasAdditionalFilters}
      onSearch={handleApply}
      searchLoading={fetchingLogs > 0}
      onReset={handleReset}
    />
  )
}
