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

import { useEffect, useMemo, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { getChannels } from '@/features/channels/api'
import {
  getChannelStatusBadge,
  getChannelTypeLabel,
} from '@/features/channels/lib/channel-utils'
import type { Channel } from '@/features/channels/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  channelFlowBindingFormSchema,
  defaultBindingFormValues,
  type ChannelFlowBindingFormValues,
} from '../lib'
import type { ChannelFlowPool, ChannelFlowPoolBinding } from '../types'

type BindingFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pool?: ChannelFlowPool | null
  bindings: ChannelFlowPoolBinding[]
  submitting: boolean
  onSubmit: (values: ChannelFlowBindingFormValues) => void
}

const CHANNEL_SELECTOR_PAGE_SIZE = 1000

export function BindingFormSheet(props: BindingFormSheetProps) {
  const { t } = useTranslation()
  const form = useForm<ChannelFlowBindingFormValues>({
    resolver: zodResolver(
      channelFlowBindingFormSchema
    ) as unknown as Resolver<ChannelFlowBindingFormValues>,
    defaultValues: defaultBindingFormValues,
  })
  const selectedChannelId = form.watch('channel_id')
  const channelsQuery = useQuery({
    queryKey: [
      'channel-flow',
      'binding-channel-options',
      CHANNEL_SELECTOR_PAGE_SIZE,
    ],
    queryFn: () =>
      getChannels({
        p: 1,
        page_size: CHANNEL_SELECTOR_PAGE_SIZE,
        id_sort: true,
      }),
    enabled: props.open,
  })

  const availableChannels = useMemo(() => {
    const rawChannels = channelsQuery.data?.data?.items ?? []
    const boundChannelIds = new Set(
      props.bindings
        .filter((binding) => binding.enabled)
        .map((binding) => binding.channel_id)
    )
    return rawChannels.filter((channel) => !boundChannelIds.has(channel.id))
  }, [channelsQuery.data, props.bindings])

  useEffect(() => {
    if (!props.open) return
    form.reset(defaultBindingFormValues)
  }, [form, props.open])

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{t('Bind channel')}</SheetTitle>
          <SheetDescription>
            {props.pool
              ? t('Pool: {{name}}', { name: props.pool.name })
              : t('Select a Flow Pool first')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='channel-flow-binding-form'
            className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2'
            onSubmit={form.handleSubmit(props.onSubmit)}
          >
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='bg-muted/40 flex items-center justify-between gap-4 rounded-lg border p-3'>
                  <div className='space-y-1'>
                    <FormLabel>{t('Enabled')}</FormLabel>
                    <FormDescription>
                      {t('Disabled bindings are retained but ignored by routing.')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='channel_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Channel')}</FormLabel>
                  <FormControl>
                    <ChannelPicker
                      channels={availableChannels}
                      loading={channelsQuery.isLoading}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'The channel keeps its own upstream Base URL and model mapping; this binding only attaches pool capacity to that channel.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='match_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Binding mode')}</FormLabel>
                  <FormControl>
                    <div className='border-input bg-muted/40 flex h-10 items-center justify-between rounded-lg border px-3 text-sm'>
                      <span>{t('Channel')}</span>
                      <Badge variant='outline'>Phase 1</Badge>
                      <input type='hidden' {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t('Phase 1 supports channel-level binding only.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <SheetFooter className='border-t'>
          <Button
            form='channel-flow-binding-form'
            type='submit'
            disabled={!props.pool || props.submitting || selectedChannelId <= 0}
          >
            {props.submitting && <Loader2 className='size-4 animate-spin' />}
            {t('Bind channel')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

type ChannelPickerProps = {
  channels: Channel[]
  loading: boolean
  value: number
  onValueChange: (value: number) => void
}

function ChannelPicker(props: ChannelPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const selectedChannel = props.channels.find(
    (channel) => channel.id === props.value
  )

  const filteredChannels = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return props.channels

    return props.channels.filter((channel) => {
      const typeLabel = t(getChannelTypeLabel(channel.type)).toLowerCase()
      return [
        String(channel.id),
        channel.name,
        channel.base_url || '',
        channel.models || '',
        typeLabel,
      ].some((value) => value.toLowerCase().includes(search))
    })
  }, [props.channels, searchValue, t])

  const handleSelect = (channelId: number) => {
    props.onValueChange(channelId)
    setOpen(false)
    setSearchValue('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className='border-input bg-muted/40 hover:bg-muted/55 hover:text-foreground active:bg-background data-popup-open:border-ring data-popup-open:bg-background data-popup-open:ring-ring/20 h-auto min-h-14 w-full justify-between gap-3 rounded-lg px-3 py-2 text-start shadow-none data-popup-open:ring-[3px]'
          />
        }
      >
        {selectedChannel ? (
          <ChannelOptionContent channel={selectedChannel} compact />
        ) : (
          <span className='text-muted-foreground'>{t('Channel')}</span>
        )}
        <ChevronsUpDown className='text-muted-foreground size-4 shrink-0' />
      </PopoverTrigger>
      <PopoverContent
        className='data-closed:zoom-out-100 data-open:zoom-in-100 data-[side=bottom]:slide-in-from-top-0 data-[side=left]:slide-in-from-right-0 data-[side=right]:slide-in-from-left-0 data-[side=top]:slide-in-from-bottom-0 w-[var(--anchor-width)] overflow-hidden rounded-xl p-0 shadow-lg data-closed:duration-75 data-open:duration-100'
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('Search...')}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className='max-h-[360px]'>
            <CommandEmpty>
              {props.loading ? t('Loading') : t('No Channels Found')}
            </CommandEmpty>
            <CommandGroup>
              {filteredChannels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={[
                    channel.id,
                    channel.name,
                    channel.base_url,
                    channel.models,
                    t(getChannelTypeLabel(channel.type)),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onSelect={() => handleSelect(channel.id)}
                  className='data-[selected=true]:bg-muted items-start gap-3 rounded-lg px-3 py-3 transition-colors'
                >
                  <Check
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      props.value === channel.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <ChannelOptionContent channel={channel} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ChannelOptionContent({
  channel,
  compact = false,
}: {
  channel: Channel
  compact?: boolean
}) {
  const { t } = useTranslation()
  const status = getChannelStatusBadge(channel.status)
  const typeLabel = t(getChannelTypeLabel(channel.type))

  return (
    <span className='min-w-0 flex-1'>
      <span className='flex min-w-0 items-center gap-2'>
        <span className='truncate font-medium'>{channel.name}</span>
        <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
          #{channel.id}
        </span>
      </span>
      <span className='mt-1 flex min-w-0 flex-wrap items-center gap-1.5'>
        <Badge variant='outline'>{typeLabel}</Badge>
        {!compact && <Badge variant='outline'>{t(status.label)}</Badge>}
        {channel.base_url && (
          <span className='text-muted-foreground min-w-0 truncate text-xs'>
            {t('Base URL')}: {channel.base_url}
          </span>
        )}
      </span>
    </span>
  )
}
