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
import { ArrowDown, ArrowUp, GripVertical, Undo2 } from 'lucide-react'
import { useContext, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import type { DataTableViewMode } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { CHANNEL_PRIORITY_GUIDE_KEYS } from '../constants'
import type { useChannelPriorityOrder } from '../hooks/use-channel-priority-order'
import type { ChannelSortBy } from '../types'
import { ChannelPriorityContext } from './channel-priority-context'
import { ChannelPriorityGuide } from './channel-priority-guide'

export function ChannelPriorityHandle(props: { id: number }) {
  const controls = useContext(ChannelPriorityContext)
  const { t } = useTranslation()
  if (!controls) return null
  let hint = t(
    'Drag to change priority. Use arrow keys to move, Escape to cancel.'
  )
  if (controls.reason === 'sort') hint = t('Sort by priority to drag channels')
  if (controls.reason === 'tag') {
    hint = t('Disable tag grouping to drag channels')
  }
  if (controls.reason === 'permission') {
    hint = t('You do not have permission to edit channels')
  }
  if (controls.reason === 'busy') hint = t('Saving...')
  return (
    <Tooltip>
      <TooltipTrigger render={<span className='inline-flex shrink-0' />}>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className='text-muted-foreground cursor-grab touch-none active:cursor-grabbing'
          disabled={!!controls.reason}
          aria-label={
            controls.reason === 'tag'
              ? hint
              : t('Reorder channel {{id}}', { id: props.id })
          }
          onPointerDown={(event) => controls.start(event, props.id)}
          onKeyDown={(event) => controls.keyDown(event, props.id)}
        >
          <GripVertical className='size-4' aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

export function ChannelSortControl(props: {
  field: ChannelSortBy
  desc: boolean
  disabled?: boolean
  onChange: (field: ChannelSortBy, desc: boolean) => void
}) {
  const { t } = useTranslation()
  const options = [
    { value: 'priority', label: t('Priority') },
    { value: 'id', label: t('ID') },
    { value: 'name', label: t('Name') },
    { value: 'balance', label: t('Balance') },
    { value: 'response_time', label: t('Response') },
    { value: 'test_time', label: t('Last Tested') },
  ]
  return (
    <ButtonGroup aria-label={t('Sort channels by')} className='shrink-0'>
      <Select
        value={props.field}
        disabled={props.disabled}
        onValueChange={(value) => {
          if (value) props.onChange(value as ChannelSortBy, props.desc)
        }}
        items={options}
      >
        <SelectTrigger
          aria-label={t('Sort channels by')}
          className='bg-background min-w-24'
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type='button'
        size='icon'
        variant='outline'
        disabled={props.disabled}
        aria-label={props.desc ? t('Descending') : t('Ascending')}
        title={props.desc ? t('Descending') : t('Ascending')}
        onClick={() => props.onChange(props.field, !props.desc)}
      >
        {props.desc ? (
          <ArrowDown aria-hidden className='size-4' />
        ) : (
          <ArrowUp aria-hidden className='size-4' />
        )}
      </Button>
    </ButtonGroup>
  )
}

export function ChannelPriorityModeToggle(props: {
  active: boolean
  viewMode: DataTableViewMode
  reason: 'sort' | 'tag' | 'permission' | 'busy' | null
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideSeen, setGuideSeen] = useState<
    Partial<Record<DataTableViewMode, boolean>>
  >(() => {
    try {
      return {
        card: localStorage.getItem(CHANNEL_PRIORITY_GUIDE_KEYS.card) === 'seen',
        table:
          localStorage.getItem(CHANNEL_PRIORITY_GUIDE_KEYS.table) === 'seen',
      }
    } catch {
      return {}
    }
  })
  const handleGuideOpenChange = (open: boolean) => {
    setGuideOpen(open)
    if (open) return
    setGuideSeen((seen) => ({ ...seen, [props.viewMode]: true }))
    try {
      localStorage.setItem(CHANNEL_PRIORITY_GUIDE_KEYS[props.viewMode], 'seen')
    } catch {
      // Remember dismissal for this visit when browser storage is unavailable.
    }
  }
  let hint = t('Drag mode')
  if (props.reason === 'sort') hint = t('Sort by priority to drag channels')
  if (props.reason === 'tag') hint = t('Disable tag grouping to drag channels')
  if (props.reason === 'permission') {
    hint = t('You do not have permission to edit channels')
  }
  if (props.reason === 'busy') hint = t('Saving...')
  return (
    <ButtonGroup aria-label={t('Drag mode')} className='shrink-0'>
      <Tooltip>
        <TooltipTrigger
          render={<span className='inline-flex [&>button]:rounded-r-none' />}
        >
          <Button
            type='button'
            variant='outline'
            className='text-muted-foreground aria-pressed:border-primary/30 aria-pressed:bg-primary/10 aria-pressed:text-primary aria-pressed:hover:bg-primary/15'
            aria-pressed={props.active}
            disabled={!!props.reason}
            onClick={() => {
              props.onChange()
              if (!props.active && !guideSeen[props.viewMode]) {
                setGuideOpen(true)
              }
            }}
          >
            <GripVertical className='size-4' aria-hidden />
            {props.active ? t('Finish reordering') : t('Drag mode')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
      <ChannelPriorityGuide
        open={guideOpen}
        viewMode={props.viewMode}
        onOpenChange={handleGuideOpenChange}
      />
    </ButtonGroup>
  )
}

export function ChannelPriorityStatus(props: {
  order: ReturnType<typeof useChannelPriorityOrder>
}) {
  const { t, i18n } = useTranslation()
  const order = props.order
  const hover = useSyncExternalStore(
    order.previewStore.subscribe,
    order.previewStore.getSnapshot
  )
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  let message = ''
  if (order.saving) message = t('Saving...')
  else if (hover.preparing) message = t('Calculating priority...')
  else if (hover.preview && hover.drop) {
    const value =
      hover.preview.items.find((item) => item.id === hover.drop?.id)
        ?.priority ?? 0
    const visible = new Set(order.items.map((item) => item.id))
    const hidden = hover.preview.changes.filter(
      (item) => !visible.has(item.id)
    ).length
    message = t('New priority: {{priority}} · {{count}} channels affected', {
      priority: formatNumber(value, locale),
      count: hover.preview.changes.length,
    })
    if (hidden) {
      message += ` · ${t('{{count}} outside this view', { count: hidden })}`
    }
    if (hover.drop.position === 'same') {
      message += ` · ${t('Join the same priority tier')}`
    } else {
      message += ` · ${t('Release to insert a new priority tier')}`
    }
  } else if (order.active) {
    message = t(
      'Drop between tiers to change priority, or in the center to join a tier'
    )
  }
  if (!message && !order.undo?.changes.length) return null
  return (
    <div className='text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 text-xs'>
      <span role='status' aria-live='polite'>
        {message || t('Channel priorities saved')}
      </span>
      {!!order.undo?.changes.length && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={order.active || order.saving}
          onClick={() => void order.restore()}
        >
          <Undo2 className='size-3.5' aria-hidden />
          {t('Undo')}
        </Button>
      )}
    </div>
  )
}
