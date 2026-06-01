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
import { useCallback, useMemo, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
// ✅ 修复2：直接引入官方类型
import { enUS, fr, ja, ru, vi, zhCN } from 'react-day-picker/locale'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const calendarLocales = {
  en: enUS,
  zh: zhCN,
  fr,
  ru,
  ja,
  vi,
} as const

interface StatisticsDateRangePickerProps {
  start?: Date
  end?: Date
  onChange: (range: { start?: Date; end?: Date }) => void
  className?: string
}

export function StatisticsDateRangePicker({
  start,
  end,
  onChange,
  className,
}: StatisticsDateRangePickerProps) {
  const { t, i18n } = useTranslation()
  const calendarLocale =
    calendarLocales[i18n.language as keyof typeof calendarLocales] ?? enUS
  const [open, setOpen] = useState(false)
  const [startTime, setStartTime] = useState(() =>
    start ? dayjs(start).format('HH:mm') : '00:00'
  )
  const [endTime, setEndTime] = useState(() =>
    end ? dayjs(end).format('HH:mm') : '23:59'
  )
  const [range, setRange] = useState<DateRange>({
    from: start,
    to: end,
  })
  const [month1, setMonth1] = useState<Date | undefined>(start ?? new Date())
  const [month2, setMonth2] = useState<Date | undefined>(
    start
      ? dayjs(start).add(1, 'month').toDate()
      : dayjs().add(1, 'month').toDate()
  )
  const pickedEndRef = useRef(false)

  const label = useMemo(() => {
    if (!start && !end) return t('Date Range')
    const startText = start ? dayjs(start).format('YYYY-MM-DD HH:mm') : '-'
    const endText = end ? dayjs(end).format('YYYY-MM-DD HH:mm') : '-'
    return `${startText} ~ ${endText}`
  }, [end, start, t])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setRange({ from: start, to: end })
        setStartTime(start ? dayjs(start).format('HH:mm') : '00:00')
        setEndTime(end ? dayjs(end).format('HH:mm') : '23:59')
        setMonth1(start ?? new Date())
        setMonth2(
          start
            ? dayjs(start).add(1, 'month').toDate()
            : dayjs().add(1, 'month').toDate()
        )
        pickedEndRef.current = false
      }
      setOpen(nextOpen)
    },
    [start, end]
  )

  const buildDateTime = useCallback((date: Date, timeStr: string): Date => {
    const [h, m] = timeStr.split(':').map(Number)
    const d = new Date(date)
    d.setHours(h || 0, m || 0, 0, 0)
    return d
  }, [])

  const commit = useCallback(
    (r: DateRange, sTime: string, eTime: string) => {
      onChange({
        start: r.from ? buildDateTime(r.from, sTime) : undefined,
        end: r.to ? buildDateTime(r.to, eTime) : undefined,
      })
      setOpen(false)
    },
    [onChange, buildDateTime]
  )

  const handleRangeSelect = useCallback((selected: DateRange | undefined) => {
    if (!selected) return
    if (!pickedEndRef.current) {
      setRange({ from: selected.from, to: undefined })
      pickedEndRef.current = false
    } else {
      setRange({ from: selected.from, to: selected.to })
    }
  }, [])

  const handleCalendarClick = useCallback(
    (day: Date, modifiers: Record<string, boolean>) => {
      if (modifiers.disabled) return
      if (!pickedEndRef.current) {
        setRange({ from: day, to: undefined })
        pickedEndRef.current = true
      } else {
        const from = range.from!
        const to = day
        const [realFrom, realTo] = from <= to ? [from, to] : [to, from]
        setRange({ from: realFrom, to: realTo })
      }
    },
    [range]
  )

  const applyPreset = useCallback(
    (kind: 'today' | '7d' | 'week' | '30d' | 'month') => {
      const now = dayjs()
      const presets = {
        today: {
          start: now.startOf('day').toDate(),
          end: now.toDate(),
        },
        '7d': {
          start: now.subtract(6, 'day').startOf('day').toDate(),
          end: now.toDate(),
        },
        week: {
          start: now.startOf('week').toDate(),
          end: now.toDate(),
        },
        '30d': {
          start: now.subtract(29, 'day').startOf('day').toDate(),
          end: now.toDate(),
        },
        month: {
          start: now.startOf('month').toDate(),
          end: now.toDate(),
        },
      }
      const r = presets[kind]
      onChange(r)
      setOpen(false)
    },
    [onChange]
  )

  const handleConfirm = useCallback(() => {
    commit(range, startTime, endTime)
  }, [commit, range, startTime, endTime])

  const presetButtons = useMemo(
    () => [
      { kind: 'today' as const, label: t('Today') },
      { kind: '7d' as const, label: t('7 Days') },
      { kind: 'week' as const, label: t('This week') },
      { kind: '30d' as const, label: t('30 Days') },
      { kind: 'month' as const, label: t('This month') },
    ],
    [t]
  )

  // ✅ 修复1：使用 cn 并扩充选择器。强行重写起止和选中项在 Hover 时的背景色与文字色，击碎 Ghost 样式的暗黑主题污染。
  const calendarClassNames = cn(
    'w-full',
    '[&_[data-slot=calendar]]:w-full',
    '[&_.day-range-start:hover]:bg-primary [&_.day-range-start:hover]:text-primary-foreground',
    '[&_.day-range-end:hover]:bg-primary [&_.day-range-end:hover]:text-primary-foreground',
    '[&_.day-selected:hover]:bg-primary [&_.day-selected:hover]:text-primary-foreground',
    '[&_.rdp-day_range_start:hover]:bg-primary [&_.rdp-day_range_start:hover]:text-primary-foreground',
    '[&_.rdp-day_range_end:hover]:bg-primary [&_.rdp-day_range_end:hover]:text-primary-foreground',
    '[&_.rdp-day_selected:hover]:bg-primary [&_.rdp-day_selected:hover]:text-primary-foreground',
    '[&_[aria-selected=true]:hover]:bg-primary [&_[aria-selected=true]:hover]:text-primary-foreground'
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className={cn(
              'w-full justify-start gap-2 px-2.5 font-mono text-xs font-normal',
              !start && !end && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <CalendarDays className='text-muted-foreground size-4 shrink-0' />
        <span className='truncate'>{label}</span>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-[min(640px,calc(100vw-2rem))] p-4'
      >
        <div className='flex flex-col gap-4'>
          <div className='flex gap-4 overflow-x-auto overflow-y-hidden'>
            <Calendar
              mode='range'
              numberOfMonths={1}
              selected={range}
              month={month1}
              onMonthChange={setMonth1}
              onSelect={handleRangeSelect}
              onDayClick={handleCalendarClick}
              locale={calendarLocale}
              captionLayout='dropdown'
              disabled={(date: Date) => date > new Date()}
              className={calendarClassNames}
            />
            <Calendar
              mode='range'
              numberOfMonths={1}
              selected={range}
              month={month2}
              onMonthChange={setMonth2}
              onSelect={handleRangeSelect}
              onDayClick={handleCalendarClick}
              locale={calendarLocale}
              captionLayout='dropdown'
              disabled={(date: Date) => date > new Date()}
              className={calendarClassNames}
            />
          </div>

          <div className='border-border grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t pt-4'>
            <div className='border-input flex items-center justify-between gap-2 rounded-md border px-3 py-1.5'>
              <span className='text-muted-foreground text-xs whitespace-nowrap'>
                {range.from
                  ? dayjs(range.from).format('YYYY-MM-DD')
                  : t('Start Time')}
              </span>
              <input
                type='time'
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className='h-7 w-[76px] shrink-0 border-0 bg-transparent p-0 font-mono text-xs outline-none [&::-webkit-calendar-picker-indicator]:hidden'
              />
            </div>
            <span className='text-muted-foreground text-xs'>~</span>
            <div className='border-input flex items-center justify-between gap-2 rounded-md border px-3 py-1.5'>
              <span className='text-muted-foreground text-xs whitespace-nowrap'>
                {range.to
                  ? dayjs(range.to).format('YYYY-MM-DD')
                  : t('End Time')}
              </span>
              <input
                type='time'
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className='h-7 w-[76px] shrink-0 border-0 bg-transparent p-0 font-mono text-xs outline-none [&::-webkit-calendar-picker-indicator]:hidden'
              />
            </div>
          </div>

          <div className='flex flex-wrap gap-2 pt-1'>
            {presetButtons.map((btn) => (
              <Button
                key={btn.kind}
                type='button'
                variant='secondary'
                size='sm'
                className='h-8 flex-1 px-2 text-xs'
                onClick={() => applyPreset(btn.kind)}
              >
                {btn.label}
              </Button>
            ))}
          </div>

          <div className='flex justify-end'>
            <Button size='sm' className='h-8 px-5' onClick={handleConfirm}>
              {t('Confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
