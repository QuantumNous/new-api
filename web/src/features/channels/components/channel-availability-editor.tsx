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
import { Plus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import {
  availabilityWindowsError,
  createAvailabilityWindow,
  MAX_AVAILABILITY_WINDOWS,
  WEEKDAY_ORDER,
  type ChannelAvailabilityWindow,
} from '../lib/channel-availability'
import type { ChannelFormValues } from '../lib/channel-form'

const WEEKDAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const

let nextWindowKey = 0

/**
 * Returns a stable React key per window object. Edited windows are new objects,
 * so identity stays unique while untouched windows keep their key.
 */
function useWindowKeys() {
  const keys = useRef(new WeakMap<ChannelAvailabilityWindow, string>())
  return (window: ChannelAvailabilityWindow) => {
    const existing = keys.current.get(window)
    if (existing) return existing
    const created = `availability-window-${++nextWindowKey}`
    keys.current.set(window, created)
    return created
  }
}

export function ChannelAvailabilityEditor(props: { disabled?: boolean }) {
  const { t } = useTranslation()
  const form = useFormContext<ChannelFormValues>()
  const keyFor = useWindowKeys()

  return (
    <FormField
      control={form.control}
      name='availability_windows'
      render={({ field }) => {
        const windows = field.value ?? []
        const error = availabilityWindowsError(windows)
        const update = (next: ChannelAvailabilityWindow[]) =>
          field.onChange(next)

        return (
          <FormItem>
            <FormLabel>{t('Available time windows')}</FormLabel>
            <FormDescription>
              {t(
                'Outside these windows the channel is not selected for new requests. Leave empty to keep the channel always available.'
              )}
            </FormDescription>
            <div className='flex flex-col gap-3'>
              {windows.map((window, index) => (
                <div
                  key={keyFor(window)}
                  className='flex flex-col gap-3 rounded-md border p-3'
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      {t('Window {{index}}', { index: index + 1 })}
                    </span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-sm'
                      aria-label={t('Remove window')}
                      disabled={props.disabled}
                      onClick={() =>
                        update(windows.filter((_, item) => item !== index))
                      }
                    >
                      <Trash2 className='size-4' />
                    </Button>
                  </div>
                  <div className='grid gap-3 sm:grid-cols-4'>
                    <label className='flex flex-col gap-1 text-xs'>
                      {t('Timezone')}
                      <Input
                        value={window.timezone}
                        placeholder='Asia/Shanghai'
                        disabled={props.disabled}
                        onChange={(event) =>
                          update(
                            windows.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, timezone: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <label className='flex flex-col gap-1 text-xs'>
                      {t('Start')}
                      <Input
                        type='time'
                        value={window.start}
                        disabled={props.disabled}
                        onChange={(event) =>
                          update(
                            windows.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, start: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <label className='flex flex-col gap-1 text-xs'>
                      {t('End')}
                      <Input
                        type='time'
                        value={window.end}
                        disabled={props.disabled}
                        onChange={(event) =>
                          update(
                            windows.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, end: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <div className='flex flex-col gap-1 text-xs'>
                      {t('Weekdays')}
                      <ToggleGroup
                        type='multiple'
                        variant='outline'
                        size='sm'
                        disabled={props.disabled}
                        value={window.weekdays.map(String)}
                        onValueChange={(values) =>
                          update(
                            windows.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    weekdays: values
                                      .map(Number)
                                      .sort((a, b) => a - b),
                                  }
                                : item
                            )
                          )
                        }
                      >
                        {WEEKDAY_ORDER.map((weekday) => (
                          <ToggleGroupItem
                            key={weekday}
                            value={String(weekday)}
                            aria-label={t(WEEKDAY_LABELS[weekday])}
                          >
                            {t(WEEKDAY_LABELS[weekday])}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  </div>
                </div>
              ))}
              <div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={
                    props.disabled ||
                    windows.length >= MAX_AVAILABILITY_WINDOWS
                  }
                  onClick={() =>
                    update([...windows, createAvailabilityWindow()])
                  }
                >
                  <Plus className='size-4' />
                  {t('Add window')}
                </Button>
              </div>
              {error && (
                <FormMessage>
                  {t(error, { count: MAX_AVAILABILITY_WINDOWS })}
                </FormMessage>
              )}
            </div>
          </FormItem>
        )
      }}
    />
  )
}
