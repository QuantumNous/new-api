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
import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Input } from '@/components/design-system/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { getCalendarLocale } from '@/lib/calendar-locale'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

interface CompactDateTimeRangePickerProps {
  start?: Date
  end?: Date
  onChange: (range: { start?: Date; end?: Date }) => void
  className?: string
}

// Labels are translated at render time; keep them registered in
// src/i18n/static-keys.ts so the i18n sync tooling can see them.
const RANGE_PRESETS: Array<{
  label: string
  getRange: () => { start: Date; end: Date }
}> = [
  {
    label: 'Today',
    getRange: () => {
      const now = dayjs()
      return {
        start: now.startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      }
    },
  },
  {
    label: '7 Days',
    getRange: () => {
      const now = dayjs()
      return {
        start: now.subtract(6, 'day').startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      }
    },
  },
  {
    label: 'This week',
    getRange: () => {
      const now = dayjs()
      return {
        start: now.startOf('week').toDate(),
        end: now.endOf('week').toDate(),
      }
    },
  },
  {
    label: 'Last week',
    getRange: () => {
      const lastWeek = dayjs().subtract(1, 'week')
      return {
        start: lastWeek.startOf('week').toDate(),
        end: lastWeek.endOf('week').toDate(),
      }
    },
  },
  {
    label: '30 Days',
    getRange: () => {
      const now = dayjs()
      return {
        start: now.subtract(29, 'day').startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      }
    },
  },
  {
    label: 'This month',
    getRange: () => {
      const now = dayjs()
      return {
        start: now.startOf('month').toDate(),
        end: now.endOf('month').toDate(),
      }
    },
  },
  {
    label: 'Last month',
    getRange: () => {
      const lastMonth = dayjs().subtract(1, 'month')
      return {
        start: lastMonth.startOf('month').toDate(),
        end: lastMonth.endOf('month').toDate(),
      }
    },
  },
]

// Matches the shadcn "date and time picker" pattern (Calendar + time input):
// the native picker indicator is hidden so only the themed field shows.
const timeInputClassName =
  'appearance-none tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'

function toTimeValue(date: Date | undefined, fallback: string): string {
  return date ? dayjs(date).format('HH:mm') : fallback
}

function combineDateTime(date: Date, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const combined = new Date(date)
  combined.setHours(hours, minutes, 0, 0)
  return combined
}

// Time inputs are minute-precision, so an end of "23:59" must cover the whole
// minute (23:59:59.999) — same as the endOf('day') the presets produce.
// Otherwise reopening a preset range and confirming would silently trim it.
function combineEndDateTime(date: Date, time: string): Date {
  const combined = combineDateTime(date, time)
  combined.setSeconds(59, 999)
  return combined
}

export function CompactDateTimeRangePicker({
  start,
  end,
  onChange,
  className,
}: CompactDateTimeRangePickerProps) {
  const { t, i18n } = useTranslation()
  const isMobile = useIsMobile()
  const calendarLocale = getCalendarLocale(i18n.language)
  const [open, setOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>()
  const [startTime, setStartTime] = useState('00:00')
  const [endTime, setEndTime] = useState('23:59')

  const label = useMemo(() => {
    if (!start && !end) return t('Date Range')
    // Times are minute-precision (the time inputs cannot express seconds),
    // so hide seconds in the trigger label to keep the button compact.
    const startText = start ? dayjs(start).format('YYYY-MM-DD HH:mm') : '-'
    const endText = end ? dayjs(end).format('YYYY-MM-DD HH:mm') : '-'
    return `${startText} ~ ${endText}`
  }, [end, start, t])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftRange(start || end ? { from: start, to: end } : undefined)
      setStartTime(toTimeValue(start, '00:00'))
      setEndTime(toTimeValue(end, '23:59'))
    }
    setOpen(nextOpen)
  }

  const handleCalendarSelect = (
    range: DateRange | undefined,
    selectedDay: Date
  ) => {
    // Once a full range exists, the next click starts a fresh range instead
    // of react-day-picker's default edge adjustment, which feels erratic.
    if (draftRange?.from && draftRange?.to) {
      setDraftRange({ from: selectedDay, to: undefined })
      return
    }
    setDraftRange(range)
  }

  const applyDraft = () => {
    const from = draftRange?.from
    // Selecting a single day leaves `to` empty; treat it as a one-day range.
    const to = draftRange?.to ?? draftRange?.from
    onChange({
      start: from ? combineDateTime(from, startTime) : undefined,
      end: to ? combineEndDateTime(to, endTime) : undefined,
    })
    setOpen(false)
  }

  const applyPreset = (getRange: () => { start: Date; end: Date }) => {
    const range = getRange()
    setDraftRange({ from: range.start, to: range.end })
    setStartTime(toTimeValue(range.start, '00:00'))
    setEndTime(toTimeValue(range.end, '23:59'))
    onChange(range)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className={cn(
              'w-full justify-start gap-2 px-2.5 text-sm leading-5 font-normal tabular-nums',
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
        className='w-auto max-w-[calc(100vw-2rem)] p-0'
      >
        <div className='flex max-sm:max-h-[75vh] max-sm:flex-col max-sm:overflow-y-auto'>
          {/* One-click presets: side rail on desktop, grid on mobile. */}
          <div className='grid shrink-0 grid-cols-2 gap-1 border-b p-2 sm:flex sm:flex-col sm:border-r sm:border-b-0'>
            {RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type='button'
                variant='ghost'
                className='justify-start font-normal'
                onClick={() => applyPreset(preset.getRange)}
              >
                {t(preset.label)}
              </Button>
            ))}
          </div>

          <div className='p-3'>
            <Calendar
              mode='range'
              numberOfMonths={isMobile ? 1 : 2}
              // Outside days would render range days twice across the two
              // months (e.g. Jul 31 again in August's first row).
              showOutsideDays={false}
              selected={draftRange}
              onSelect={handleCalendarSelect}
              defaultMonth={draftRange?.from}
              locale={calendarLocale}
            />

            <div className='mt-3 flex items-end gap-2 border-t pt-3'>
              <div className='min-w-0 flex-1 space-y-1.5'>
                <div className='text-muted-foreground text-xs'>
                  {t('Start Time')}
                </div>
                <Input
                  type='time'
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={timeInputClassName}
                />
              </div>
              <span className='text-muted-foreground pb-2 text-xs'>~</span>
              <div className='min-w-0 flex-1 space-y-1.5'>
                <div className='text-muted-foreground text-xs'>
                  {t('End Time')}
                </div>
                <Input
                  type='time'
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={timeInputClassName}
                />
              </div>
              <Button onClick={applyDraft}>{t('Confirm')}</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
