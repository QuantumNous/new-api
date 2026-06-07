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
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Calendar, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { getCalendarDateRangeUntilNow, type TimeGranularity } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/datetime-picker'
import {
  DASHBOARD_PROVIDER_OPTIONS,
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  cleanFilters,
  getDashboardProviderLabelKey,
} from '@/features/dashboard/lib'
import type {
  DashboardChartPreferences,
  DashboardFilters,
  DashboardProviderFilter,
} from '@/features/dashboard/types'

interface ModelsFilterBarProps {
  filters: DashboardFilters
  preferences: DashboardChartPreferences
  onFilterChange: (filters: DashboardFilters) => void
  onReset: () => void
}

type DraftField = keyof DashboardFilters

export function ModelsFilterBar(props: ModelsFilterBarProps) {
  const { t } = useTranslation()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)
  const [draft, setDraft] = useState<DashboardFilters>(props.filters)
  const [selectedRange, setSelectedRange] = useState<number | null>(
    props.preferences.defaultTimeRangeDays
  )

  useEffect(() => {
    setDraft(props.filters)
  }, [props.filters])

  const providerItems = useMemo(
    () =>
      DASHBOARD_PROVIDER_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  )

  const granularityItems = useMemo(
    () =>
      TIME_GRANULARITY_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.label),
      })),
    [t]
  )

  const activeBadges = useMemo(() => {
    const items: string[] = []
    const provider = props.filters.provider ?? 'all'
    if (props.filters.model_name?.trim()) {
      items.push(`${t('Model')}: ${props.filters.model_name.trim()}`)
    }
    if (isAdmin && provider !== 'all') {
      items.push(t(getDashboardProviderLabelKey(provider)))
    }
    if (isAdmin && props.filters.username?.trim()) {
      items.push(`${t('Username')}: ${props.filters.username.trim()}`)
    }
    return items
  }, [isAdmin, props.filters, t])

  const handleDraftChange = (
    field: DraftField,
    value: Date | string | undefined
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
    if (field === 'start_timestamp' || field === 'end_timestamp') {
      setSelectedRange(null)
    }
  }

  const handleQuickRange = (days: number) => {
    const { start, end } = getCalendarDateRangeUntilNow(days)
    setDraft((prev) => ({
      ...prev,
      start_timestamp: start,
      end_timestamp: end,
    }))
    setSelectedRange(days)
  }

  const handleApply = () => {
    const next = cleanFilters(
      draft as unknown as Record<string, unknown>
    ) as DashboardFilters
    props.onFilterChange(
      isAdmin ? next : { ...next, username: '', provider: 'all' }
    )
  }

  const handleReset = () => {
    const next = buildDefaultDashboardFilters(props.preferences)
    setDraft(next)
    setSelectedRange(props.preferences.defaultTimeRangeDays)
    props.onReset()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleApply()
  }

  return (
    <div className='rounded-lg border p-3 sm:p-4'>
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <SlidersHorizontal className='text-muted-foreground/60 size-4' />
            <span className='text-sm font-semibold'>{t('Filters')}</span>
            {activeBadges.length > 0 && (
              <Badge variant='secondary'>{t('Filters active')}</Badge>
            )}
          </div>
          {activeBadges.length > 0 && (
            <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
              {activeBadges.map((badge) => (
                <Badge key={badge} variant='outline' className='max-w-56'>
                  <span className='truncate'>{badge}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className='flex flex-wrap items-center gap-1.5'>
          <Label className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <Calendar className='size-3.5' />
            {t('Quick Range')}
          </Label>
          {TIME_RANGE_PRESETS.map((range) => (
            <Button
              key={range.days}
              type='button'
              size='xs'
              variant={selectedRange === range.days ? 'default' : 'outline'}
              onClick={() => handleQuickRange(range.days)}
              className={cn(
                selectedRange === range.days && 'ring-ring ring-2 ring-offset-1'
              )}
            >
              {t(range.label)}
            </Button>
          ))}
        </div>

        <div className='flex flex-wrap items-end gap-2'>
          <div className='grid min-w-[17rem] flex-1 gap-1.5'>
            <Label className='text-xs' htmlFor='dashboard-start-time'>
              {t('Start Time')}
            </Label>
            <DateTimePicker
              value={draft.start_timestamp}
              onChange={(date) =>
                handleDraftChange('start_timestamp', date || undefined)
              }
              placeholder={t('Select start time')}
            />
          </div>

          <div className='grid min-w-[17rem] flex-1 gap-1.5'>
            <Label className='text-xs' htmlFor='dashboard-end-time'>
              {t('End Time')}
            </Label>
            <DateTimePicker
              value={draft.end_timestamp}
              onChange={(date) =>
                handleDraftChange('end_timestamp', date || undefined)
              }
              placeholder={t('Select end time')}
            />
          </div>

          <div className='grid w-full gap-1.5 sm:w-36'>
            <Label className='text-xs' htmlFor='dashboard-granularity'>
              {t('Time Granularity')}
            </Label>
            <Select
              items={granularityItems}
              value={draft.time_granularity}
              onValueChange={(value) =>
                handleDraftChange('time_granularity', value as TimeGranularity)
              }
            >
              <SelectTrigger id='dashboard-granularity' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {TIME_GRANULARITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <div className='grid w-full gap-1.5 sm:w-44'>
              <Label className='text-xs' htmlFor='dashboard-provider'>
                {t('Provider')}
              </Label>
              <Select
                items={providerItems}
                value={draft.provider ?? 'all'}
                onValueChange={(value) =>
                  handleDraftChange(
                    'provider',
                    (value ?? 'all') as DashboardProviderFilter
                  )
                }
              >
                <SelectTrigger id='dashboard-provider' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {DASHBOARD_PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className='grid w-full gap-1.5 sm:w-56'>
            <Label className='text-xs' htmlFor='dashboard-model-name'>
              {t('Model')}
            </Label>
            <Input
              id='dashboard-model-name'
              placeholder={t('Filter by model name...')}
              value={draft.model_name ?? ''}
              onChange={(event) =>
                handleDraftChange('model_name', event.target.value)
              }
              onKeyDown={handleInputKeyDown}
            />
          </div>

          {isAdmin && (
            <div className='grid w-full gap-1.5 sm:w-56'>
              <Label className='text-xs' htmlFor='dashboard-username'>
                {t('Username')}
              </Label>
              <Input
                id='dashboard-username'
                placeholder={t('Filter by username')}
                value={draft.username ?? ''}
                onChange={(event) =>
                  handleDraftChange('username', event.target.value)
                }
                onKeyDown={handleInputKeyDown}
              />
            </div>
          )}

          <div className='flex w-full items-end gap-2 sm:w-auto'>
            <Button
              type='button'
              variant='outline'
              className='flex-1 sm:flex-none'
              onClick={handleReset}
            >
              <RotateCcw data-icon='inline-start' />
              {t('Reset')}
            </Button>
            <Button
              type='button'
              className='flex-1 sm:flex-none'
              onClick={handleApply}
            >
              <Search data-icon='inline-start' />
              {t('Apply Filters')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
