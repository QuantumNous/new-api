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
import { Filter, RotateCcw, Calendar, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useQuery } from '@tanstack/react-query'
import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks'
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  cleanFilters,
} from '@/features/dashboard/lib'
import type {
  DashboardChartPreferences,
  DashboardFilters,
} from '@/features/dashboard/types'
import { searchAdminApiKeys, searchApiKeys, getApiKey } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { getRollingDateRange, type TimeGranularity } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface ModelsFilterProps {
  preferences: DashboardChartPreferences
  // The filters currently applied to the dashboard. The dialog edits a copy of
  // these so reopening it never discards a manually picked range.
  currentFilters: DashboardFilters
  onFilterChange: (filters: DashboardFilters) => void
  onReset: () => void
  titleKey?: string
  descriptionKey?: string
}

// Quick-range presets imply a sensible granularity (matching the app's
// range<->granularity pairing), so picking "7 Days" requests daily buckets
// instead of leaving the granularity on its previous value (e.g. hourly).
function granularityForRangeDays(days: number): TimeGranularity {
  if (days <= 1) return 'hour'
  if (days >= 29) return 'week'
  return 'day'
}

// Highlights the matching quick-range button when the applied range spans an
// exact preset; custom ranges leave every quick button unselected.
function detectQuickRangeDays(
  filters: DashboardFilters | undefined
): number | null {
  const start = filters?.start_timestamp
  const end = filters?.end_timestamp
  if (!start || !end) return null
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return TIME_RANGE_PRESETS.some((preset) => preset.days === days) ? days : null
}

/**
 * Section divider component for better visual organization
 */
const SectionDivider = ({ label }: { label: string }) => (
  <div className='relative'>
    <div className='absolute inset-0 flex items-center'>
      <span className='w-full border-t' />
    </div>
    <div className='relative flex justify-center text-xs uppercase'>
      <span className='bg-background text-muted-foreground px-2'>{label}</span>
    </div>
  </div>
)

interface TokenFilterComboboxProps {
  value?: number
  onValueChange: (value?: number) => void
  isAdmin: boolean
}

// 可搜索单选 API KEY 选择器；管理员可查看全部 key，普通用户只能查看自己的 key。
// 使用 Base UI Combobox，搜索框固定不动，输入即触发后端搜索，大小写不敏感。
function TokenFilterCombobox({
  value,
  onValueChange,
  isAdmin,
}: TokenFilterComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  // 搜索词防抖，避免每输入一个字符就触发一次后端请求。
  const debouncedKeyword = useDebounce(keyword, 300)
  const [inputValue, setInputValue] = useState('')
  // 缓存所有加载过的 token id -> name，避免选择后因当前 options 被过滤而找不到 label。
  const [tokenMap, setTokenMap] = useState<Record<string, string>>({})

  const { data: tokenOptions } = useQuery<ApiKey[]>({
    queryKey: [
      'dashboard',
      'token-options',
      isAdmin ? 'admin' : 'self',
      debouncedKeyword,
    ],
    queryFn: async () => {
      const res = isAdmin
        ? await searchAdminApiKeys({ keyword: debouncedKeyword, size: 100 })
        : await searchApiKeys({ keyword: debouncedKeyword, size: 100 })
      return res.success ? (res.data?.items ?? []) : []
    },
    enabled: open,
    staleTime: 60_000,
  })

  // 预选中的 key 若不在已加载的搜索结果中（例如来自 URL/持久化筛选且 token 较旧），
  // 单独按 id 取一次名称，避免输入框错误地回退显示“全部 API 密钥”。
  const { data: preselectedToken } = useQuery<ApiKey | null>({
    queryKey: ['dashboard', 'token-selected', value],
    queryFn: async () => {
      if (!value) return null
      const res = await getApiKey(value)
      return res.success ? (res.data ?? null) : null
    },
    enabled: !!value && !tokenMap[String(value)],
    staleTime: 60_000,
  })

  // 把每次后端返回的 token 更新到缓存中，确保已选项名称始终可解析。
  useEffect(() => {
    const incoming = [...(tokenOptions ?? [])]
    if (preselectedToken) incoming.push(preselectedToken)
    if (incoming.length === 0) return
    setTokenMap((prev) => {
      const next = { ...prev }
      for (const token of incoming) {
        next[String(token.id)] = token.name
      }
      return next
    })
  }, [tokenOptions, preselectedToken])

  const options = useMemo(() => {
    const allOption = { value: '__all__', label: t('All API keys') }
    return [
      allOption,
      ...(tokenOptions ?? []).map((token) => ({
        value: String(token.id),
        label: token.name,
      })),
    ]
  }, [tokenOptions, t])

  const items = useMemo(() => options.map((option) => option.value), [options])
  const selectedValue = value ? String(value) : '__all__'
  const selectedLabel =
    selectedValue === '__all__'
      ? t('All API keys')
      : (tokenMap[selectedValue] ?? '')

  // 下拉框关闭或选中项变化时，输入框恢复为当前选中项名称，便于用户看清已选内容。
  useEffect(() => {
    if (!open) {
      setInputValue(selectedLabel || t('All API keys'))
    }
  }, [open, selectedLabel, t])

  // Base UI 在选择/关闭时可能尝试把 value 转回输入框文本；
  // 用 tokenMap 而不是当前 options 解析，防止回退显示数据库 id。
  const itemToStringLabel = useCallback(
    (itemValue: string) => {
      if (itemValue === '__all__') return t('All API keys')
      return tokenMap[itemValue] ?? itemValue
    },
    [tokenMap, t]
  )

  const handleValueChange = (nextValue: string | null) => {
    if (nextValue === '__all__' || nextValue === null) {
      onValueChange(undefined)
      setInputValue(t('All API keys'))
    } else {
      onValueChange(Number(nextValue))
      // 选择后立即写入名称，防止 Base UI 用 value（id）回填输入框。
      const label = tokenMap[nextValue] ?? nextValue
      setInputValue(label)
    }
    setOpen(false)
  }

  const handleInputValueChange = (nextInputValue: string) => {
    setInputValue(nextInputValue)
    setKeyword(nextInputValue)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      // 打开下拉框时清空输入框，方便用户立即输入搜索词。
      setInputValue('')
      setKeyword('')
    }
  }

  return (
    <Combobox
      value={selectedValue}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={handleInputValueChange}
      open={open}
      onOpenChange={handleOpenChange}
      items={items}
      itemToStringLabel={itemToStringLabel}
      autoComplete='none'
      filter={() => true}
    >
      <ComboboxInput
        id='token_id'
        placeholder={t('Search API keys...')}
        showTrigger
      />
      <ComboboxContent>
        <ComboboxList>
          {options.map((option) => (
            <ComboboxItem key={option.value} value={option.value}>
              <span className='truncate'>{option.label}</span>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function ModelsFilter(props: ModelsFilterProps) {
  const { t } = useTranslation()
  // 使用已缓存的用户数据，避免重复调用 API
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = user?.role && user.role >= 10

  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<DashboardFilters>(
    () =>
      props.currentFilters ?? buildDefaultDashboardFilters(props.preferences)
  )
  const [selectedRange, setSelectedRange] = useState<number | null>(() =>
    detectQuickRangeDays(props.currentFilters)
  )

  const handleOpenChange = (nextOpen: boolean) => {
    // Sync the editing state from the applied filters every time the dialog
    // opens so a previously applied manual range is preserved.
    if (nextOpen) {
      const applied =
        props.currentFilters ?? buildDefaultDashboardFilters(props.preferences)
      setFilters(applied)
      setSelectedRange(detectQuickRangeDays(applied))
    }
    setOpen(nextOpen)
  }

  const handleApply = () => {
    props.onFilterChange(
      cleanFilters(
        filters as unknown as Record<string, unknown>
      ) as typeof filters
    )
    setOpen(false)
  }

  const handleReset = () => {
    const days = props.preferences.defaultTimeRangeDays
    const { start, end } = getRollingDateRange(days)
    setFilters({
      ...buildDefaultDashboardFilters(props.preferences),
      start_timestamp: start,
      end_timestamp: end,
    })
    setSelectedRange(days)
    props.onReset()
    setOpen(false)
  }

  const handleChange = (
    field: keyof DashboardFilters,
    value: Date | string | number | undefined
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    if (field === 'start_timestamp' || field === 'end_timestamp') {
      setSelectedRange(null)
    }
  }

  const handleQuickRange = (days: number) => {
    const { start, end } = getRollingDateRange(days)

    setFilters((prev) => ({
      ...prev,
      start_timestamp: start,
      end_timestamp: end,
      time_granularity: granularityForRangeDays(days),
    }))
    setSelectedRange(days)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant='outline' size='sm'>
          <Filter className='mr-2 h-4 w-4' />
          {t('Filter')}
        </Button>
      }
      title={t(props.titleKey ?? 'Model Analytics Filters')}
      description={t(
        props.descriptionKey ??
          'Filter the model analytics view by time range, user and API key.'
      )}
      contentClassName='max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:p-4 sm:max-w-lg'
      contentHeight='min(48vh, 460px)'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      footer={
        <>
          <Button onClick={handleReset} variant='outline' type='button'>
            <RotateCcw className='mr-2 h-4 w-4' />
            {t('Reset')}
          </Button>
          <Button onClick={handleApply} type='submit'>
            <Search className='mr-2 h-4 w-4' />
            {t('Apply Filters')}
          </Button>
        </>
      }
    >
      <ScrollArea className='h-full pr-3 sm:pr-4'>
        <div className='grid gap-2.5 py-2'>
          {/* Quick time range selection */}
          <div className='grid gap-2'>
            <Label className='flex items-center gap-2'>
              <Calendar className='h-4 w-4' />
              {t('Quick Range')}
            </Label>
            <div className='grid grid-cols-2 gap-2 sm:flex'>
              {TIME_RANGE_PRESETS.map((range) => (
                <Button
                  key={range.days}
                  type='button'
                  size='sm'
                  variant={selectedRange === range.days ? 'default' : 'outline'}
                  onClick={() => handleQuickRange(range.days)}
                  className={cn(
                    'flex-1',
                    selectedRange === range.days &&
                      'ring-ring ring-2 ring-offset-2'
                  )}
                >
                  {t(range.label)}
                </Button>
              ))}
            </div>
          </div>

          <SectionDivider label={t('Custom Time Range')} />

          {/* Custom time range */}
          <div className='grid gap-2.5'>
            <div className='grid gap-2'>
              <Label htmlFor='start_timestamp'>{t('Start Time')}</Label>
              <DateTimePicker
                value={filters.start_timestamp}
                onChange={(date) =>
                  handleChange('start_timestamp', date || undefined)
                }
                placeholder={t('Select start time')}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='end_timestamp'>{t('End Time')}</Label>
              <DateTimePicker
                value={filters.end_timestamp}
                onChange={(date) =>
                  handleChange('end_timestamp', date || undefined)
                }
                placeholder={t('Select end time')}
              />
            </div>
          </div>

          <SectionDivider label={t('Chart Settings')} />

          <div className='grid gap-2'>
            <Label htmlFor='time_granularity'>{t('Time Granularity')}</Label>
            <Select
              items={TIME_GRANULARITY_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.label),
              }))}
              value={filters.time_granularity}
              onValueChange={(value) =>
                handleChange('time_granularity', value as TimeGranularity)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('Select time granularity')} />
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

          <SectionDivider label={t('API Key Filter')} />

          <div className='grid gap-2'>
            <Label htmlFor='token_id'>{t('API key')}</Label>
            <TokenFilterCombobox
              value={filters.token_id}
              onValueChange={(value) => handleChange('token_id', value)}
              isAdmin={Boolean(isAdmin)}
            />
          </div>

          {/* Admin-only fields */}
          {isAdmin && (
            <>
              <SectionDivider label={t('Admin Only')} />

              <div className='grid gap-2'>
                <Label htmlFor='username'>{t('Username')}</Label>
                <Input
                  id='username'
                  placeholder={t('Filter by username')}
                  value={filters.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </Dialog>
  )
}
