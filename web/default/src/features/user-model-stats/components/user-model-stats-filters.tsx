import { useState, useEffect } from 'react'
import { Download, Search, CalendarIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import dayjs from '@/lib/dayjs'
import { zhCN, enUS } from 'date-fns/locale'

export interface FilterValues {
  startDate: Date
  endDate: Date
  username: string
  modelName: string
  userGroup: string
}

interface UserModelStatsFiltersProps {
  filters: FilterValues
  onFilterChange: <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => void
  onSearch: () => void
  onExport: () => void
  loading?: boolean
}

export function UserModelStatsFilters({
  filters,
  onFilterChange,
  onSearch,
  onExport,
  loading,
}: UserModelStatsFiltersProps) {
  const { t, i18n } = useTranslation()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [groups, setGroups] = useState<string[]>([])

  // Pick date-fns locale matching current i18n language
  const dateLocale = i18n.language?.startsWith('zh') ? zhCN : enUS

  useEffect(() => {
    api
      .get('/api/group/')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setGroups(res.data.data as string[])
        }
      })
      .catch(() => {
        // ignore – the text input fallback is still usable
      })
  }, [])

  return (
    <div className='flex flex-wrap items-center gap-3'>
      {/* Date range picker */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger>
          <Button
            variant='outline'
            className={cn('w-[300px] justify-start text-left font-normal')}
          >
            <CalendarIcon className='mr-2 h-4 w-4' />
            {dayjs(filters.startDate).format('YYYY-MM-DD')} ~{' '}
            {dayjs(filters.endDate).format('YYYY-MM-DD')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <div className='flex gap-2 p-3'>
            <div className='space-y-1'>
              <Label>{t('Start')}</Label>
              <Calendar
                mode='single'
                selected={filters.startDate}
                onSelect={(d) => {
                  if (d) {
                    onFilterChange('startDate', d)
                  }
                }}
                locale={dateLocale}
              />
            </div>
            <div className='space-y-1'>
              <Label>{t('End')}</Label>
              <Calendar
                mode='single'
                selected={filters.endDate}
                onSelect={(d) => {
                  if (d) {
                    onFilterChange('endDate', d)
                    setCalendarOpen(false)
                  }
                }}
                locale={dateLocale}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Username */}
      <Input
        className='w-44'
        placeholder={t('Username')}
        value={filters.username}
        onChange={(e) => onFilterChange('username', e.target.value)}
      />

      {/* Model name */}
      <Input
        className='w-44'
        placeholder={t('Model name')}
        value={filters.modelName}
        onChange={(e) => onFilterChange('modelName', e.target.value)}
      />

      {/* User group – Select dropdown */}
      <Select
        value={filters.userGroup || '__all__'}
        onValueChange={(v) =>
          onFilterChange('userGroup', v === '__all__' ? '' : (v ?? ''))
        }
      >
        <SelectTrigger className='w-44'>
          <SelectValue placeholder={t('All Groups')} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value='__all__'>{t('All Groups')}</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Search */}
      <Button size='sm' onClick={onSearch} disabled={loading}>
        <Search className='mr-1 h-4 w-4' />
        {t('Search')}
      </Button>

      {/* Export (right-aligned) */}
      <Button
        size='sm'
        variant='outline'
        onClick={onExport}
        className='ml-auto'
      >
        <Download className='mr-1 h-4 w-4' />
        {t('Export CSV')}
      </Button>
    </div>
  )
}
