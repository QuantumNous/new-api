import { Calendar as CalendarIcon } from 'lucide-react'
import { enUS, fr, ja, ru, vi, zhCN } from 'react-day-picker/locale'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
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

type DatePickerProps = {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  placeholder?: string
}

export function DatePicker({
  selected,
  onSelect,
  placeholder,
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const placeholderText = placeholder ?? t('Pick a date')
  const calendarLocale =
    calendarLocales[i18n.language as keyof typeof calendarLocales] ?? enUS
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            data-empty={!selected}
            className='data-[empty=true]:text-muted-foreground w-[240px] justify-start text-start font-normal'
          />
        }
      >
        {selected ? (
          dayjs(selected).format('YYYY-MM-DD')
        ) : (
          <span>{placeholderText}</span>
        )}
        <CalendarIcon className='ms-auto h-4 w-4 opacity-50' />
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0'>
        <Calendar
          mode='single'
          captionLayout='dropdown'
          selected={selected}
          onSelect={onSelect}
          locale={calendarLocale}
          disabled={(date: Date) =>
            date > new Date() || date < new Date('1900-01-01')
          }
        />
      </PopoverContent>
    </Popover>
  )
}
