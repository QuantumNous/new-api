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
*/
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getChannels } from '@/features/channels/api'
import type { Channel } from '@/features/channels/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ChannelMultiSelectProps {
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function ChannelMultiSelect({
  value,
  onChange,
  disabled,
}: ChannelMultiSelectProps) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['all-channels-for-picker'],
    queryFn: async () => {
      const result = await getChannels({ page_size: 1000, id_sort: true })
      return (result.data?.items ?? []) as Channel[]
    },
  })

  const channels = data ?? []
  const selectedSet = new Set(value)

  const toggle = (id: number) => {
    const next = new Set(selectedSet)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onChange([...next])
  }

  const summary =
    value.length === 0
      ? t('Select channels')
      : t('{{count}} channel(s) selected', { count: value.length })

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            disabled={disabled}
            className='w-full justify-between'
          >
            <span className='truncate'>{summary}</span>
            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        }
      />
      <PopoverContent className='w-[var(--radix-popover-trigger-width)] p-0'>
        <div className='max-h-72 overflow-y-auto p-1'>
          {isLoading && (
            <div className='p-3 text-sm text-muted-foreground'>
              {t('Loading...')}
            </div>
          )}
          {!isLoading && channels.length === 0 && (
            <div className='p-3 text-sm text-muted-foreground'>
              {t('No channels available')}
            </div>
          )}
          {channels.map((channel) => {
            const checked = selectedSet.has(channel.id)
            return (
              <button
                type='button'
                key={channel.id}
                onClick={() => toggle(channel.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  checked && 'bg-accent'
                )}
              >
                <Checkbox checked={checked} className='shrink-0' />
                <span className='min-w-0 flex-1 truncate'>
                  {channel.name}
                </span>
                <span className='shrink-0 text-xs text-muted-foreground'>
                  #{channel.id}
                </span>
                {checked && <Check className='h-4 w-4 shrink-0' />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
