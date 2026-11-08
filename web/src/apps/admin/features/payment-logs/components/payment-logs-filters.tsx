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
import { RotateCcw, Search as SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DatePicker } from '@/shared/components/date-picker'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { useDebounce } from '@/shared/hooks'
import dayjs from '@/shared/lib/dayjs'
import { formatDateStr } from '@/shared/lib/format'

import {
  getPaymentProviderOptions,
  getPaymentStatusOptions,
} from '../constants'

const ALL_VALUE = 'all'
const SEARCH_DEBOUNCE_MS = 400

export type PaymentLogsFiltersProps = {
  keyword: string
  status: string
  provider: string
  /** ISO Gregorian calendar date (YYYY-MM-DD). */
  fromDate: string
  /** ISO Gregorian calendar date (YYYY-MM-DD). */
  toDate: string
  onKeywordChange: (value: string) => void
  onStatusChange: (value: string) => void
  onProviderChange: (value: string) => void
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onReset: () => void
}

function toDateValue(value: string) {
  if (!value) return undefined
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.toDate() : undefined
}

/**
 * Filter panel for the payment ledger. Every field shares the same height,
 * label position and spacing, and the layout flows with logical (RTL-safe)
 * utilities so Arabic and LTR interfaces align identically.
 */
export function PaymentLogsFilters(props: PaymentLogsFiltersProps) {
  const {
    keyword,
    status,
    provider,
    fromDate,
    toDate,
    onKeywordChange,
    onStatusChange,
    onProviderChange,
    onFromDateChange,
    onToDateChange,
    onReset,
  } = props
  const { t } = useTranslation()
  const statusOptions = useMemo(() => getPaymentStatusOptions(t), [t])
  const providerOptions = useMemo(() => getPaymentProviderOptions(t), [t])
  const [searchDraft, setSearchDraft] = useState(keyword)
  const debouncedSearch = useDebounce(searchDraft, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    setSearchDraft(keyword)
  }, [keyword])

  useEffect(() => {
    const nextKeyword = debouncedSearch.trim()
    if (nextKeyword !== keyword) {
      onKeywordChange(nextKeyword)
    }
  }, [debouncedSearch, keyword, onKeywordChange])

  const fromValue = toDateValue(fromDate)
  const toValue = toDateValue(toDate)
  const today = useMemo(() => new Date(), [])
  const statusItems = useMemo(
    () => [{ value: ALL_VALUE, label: t('All') }, ...statusOptions],
    [statusOptions, t]
  )
  const providerItems = useMemo(
    () => [{ value: ALL_VALUE, label: t('All') }, ...providerOptions],
    [providerOptions, t]
  )
  const hasActiveFilters =
    Boolean(keyword || status || provider || fromDate || toDate) ||
    searchDraft.trim() !== keyword

  return (
    <div className='bg-card/60 rounded-xl border p-3 shadow-xs sm:p-4'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto] xl:items-end'>
        <div className='flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-1'>
          <Label
            htmlFor='payment-logs-search'
            className='text-muted-foreground text-xs font-medium'
          >
            {t('Search')}
          </Label>
          <div className='relative min-w-0'>
            <SearchIcon
              aria-hidden='true'
              className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2'
            />
            <Input
              id='payment-logs-search'
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t(
                'Search by trade number, email, username, or user ID...'
              )}
              className='h-9 ps-9'
              dir='auto'
            />
          </div>
        </div>

        <div className='flex min-w-0 flex-col gap-1.5'>
          <Label
            htmlFor='payment-logs-from'
            className='text-muted-foreground text-xs font-medium'
          >
            {t('From date')}
          </Label>
          <DatePicker
            id='payment-logs-from'
            selected={fromValue}
            maxDate={toValue ?? today}
            onSelect={(date) => onFromDateChange(date ? formatDateStr(date) : '')}
            placeholder={t('From date')}
            className='h-9 w-full'
          />
        </div>

        <div className='flex min-w-0 flex-col gap-1.5'>
          <Label
            htmlFor='payment-logs-to'
            className='text-muted-foreground text-xs font-medium'
          >
            {t('To date')}
          </Label>
          <DatePicker
            id='payment-logs-to'
            selected={toValue}
            minDate={fromValue}
            maxDate={today}
            onSelect={(date) => onToDateChange(date ? formatDateStr(date) : '')}
            placeholder={t('To date')}
            className='h-9 w-full'
          />
        </div>

        <div className='flex min-w-0 flex-col gap-1.5'>
          <Label
            htmlFor='payment-logs-status'
            className='text-muted-foreground text-xs font-medium'
          >
            {t('Status')}
          </Label>
          <Select
            items={statusItems}
            value={status || ALL_VALUE}
            onValueChange={(value) =>
              onStatusChange(value === ALL_VALUE ? '' : (value ?? ''))
            }
          >
            <SelectTrigger
              id='payment-logs-status'
              className='h-9 w-full'
              aria-label={t('Status')}
            >
              <SelectValue placeholder={t('All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className='flex min-w-0 flex-col gap-1.5'>
          <Label
            htmlFor='payment-logs-provider'
            className='text-muted-foreground text-xs font-medium'
          >
            {t('Payment gateway')}
          </Label>
          <Select
            items={providerItems}
            value={provider || ALL_VALUE}
            onValueChange={(value) =>
              onProviderChange(value === ALL_VALUE ? '' : (value ?? ''))
            }
          >
            <SelectTrigger
              id='payment-logs-provider'
              className='h-9 w-full'
              aria-label={t('Payment gateway')}
            >
              <SelectValue placeholder={t('All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {providerItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Button
          type='button'
          variant='outline'
          onClick={() => {
            setSearchDraft('')
            onReset()
          }}
          disabled={!hasActiveFilters}
          className='h-9 w-full gap-1.5 sm:col-span-2 lg:col-span-1 xl:w-auto xl:justify-self-end'
        >
          <RotateCcw className='size-4' aria-hidden='true' />
          {t('Reset')}
        </Button>
      </div>
    </div>
  )
}
