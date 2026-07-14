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
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpToLine, GripVertical } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { NumericSpinnerInput } from '@/features/channels/components/numeric-spinner-input'
import { cn } from '@/lib/utils'

import { movePolicyWithinGroup, suggestTopPriority } from '../lib/policy-order'
import type { ModelRoutePolicy } from '../types'

type PolicySortableGroupProps = {
  requestedModel: string
  policies: ModelRoutePolicy[]
  visiblePolicies: ModelRoutePolicy[]
  busy: boolean
  dragDisabledReason?: string
  onReorder: (ordered: ModelRoutePolicy[], movedChannelID: number) => void
  onPriorityChange: (policy: ModelRoutePolicy, value: number) => void
}

function formatChannelLabel(policy: ModelRoutePolicy) {
  const name = (policy.channel_name || '').trim()
  if (name) return `${name} (#${policy.channel_id})`
  return `#${policy.channel_id}`
}

function normalizeExternalUrl(raw?: string) {
  const value = (raw || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(value)) {
    return `https://${value}`
  }
  return ''
}

function PolicyChannelLink(props: { policy: ModelRoutePolicy }) {
  const label = formatChannelLabel(props.policy)
  const href = normalizeExternalUrl(props.policy.base_url)
  return (
    <div className='flex min-w-0 flex-col gap-0.5'>
      {href ? (
        <a
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          className='decoration-foreground/30 hover:decoration-foreground truncate font-medium underline decoration-1 underline-offset-4 transition-colors'
          title={href}
        >
          {label}
        </a>
      ) : (
        <span className='truncate font-medium' title={label}>
          {label}
        </span>
      )}
      <span className='text-muted-foreground text-xs'>
        ID: {props.policy.channel_id}
      </span>
    </div>
  )
}

function PriorityEditor(props: {
  policy: ModelRoutePolicy
  groupPolicies: ModelRoutePolicy[]
  disabled: boolean
  onChange: (value: number) => void
}) {
  const { t } = useTranslation()
  const suggestion = suggestTopPriority(props.groupPolicies)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(suggestion ?? props.policy.manual_priority)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) setDraft(suggestion ?? props.policy.manual_priority)
  }

  return (
    <div className='flex items-center gap-1'>
      <NumericSpinnerInput
        value={props.policy.manual_priority}
        onChange={props.onChange}
        min={-999}
        max={9999}
        disabled={props.disabled}
      />
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              disabled={props.disabled || suggestion === null}
              aria-label={t('Set as first')}
              title={
                suggestion === null
                  ? t('The maximum priority is already in use')
                  : t('Set as first')
              }
            >
              <ArrowUpToLine aria-hidden='true' />
            </Button>
          }
        />
        <PopoverContent align='end' className='w-64'>
          <PopoverHeader>
            <PopoverTitle>{t('Set as first')}</PopoverTitle>
            <PopoverDescription>
              {t('Review or edit the suggested priority before applying it.')}
            </PopoverDescription>
          </PopoverHeader>
          <Input
            type='number'
            min={-999}
            max={9999}
            value={draft}
            onChange={(event) => setDraft(Number(event.target.value))}
          />
          <Button
            type='button'
            size='sm'
            disabled={draft < -999 || draft > 9999}
            onClick={() => {
              props.onChange(draft)
              setOpen(false)
            }}
          >
            {t('Apply')}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function policySourceLabel(source: string, t: (key: string) => string) {
  switch (source.trim().toLowerCase()) {
    case 'configured':
      return t('Configured')
    case 'mapped':
      return t('Mapped')
    case 'observed':
      return t('Observed')
    case 'lazy_created':
      return t('Lazy created')
    default:
      return source || '—'
  }
}

function SortablePolicyRow(props: {
  policy: ModelRoutePolicy
  groupPolicies: ModelRoutePolicy[]
  busy: boolean
  dragDisabledReason?: string
  onPriorityChange: (policy: ModelRoutePolicy, value: number) => void
}) {
  const { t } = useTranslation()
  const dragDisabled = props.busy || Boolean(props.dragDisabledReason)
  const sortable = useSortable({
    id: props.policy.channel_id,
    disabled: dragDisabled,
  })
  const effective = props.policy.effective_model || props.policy.requested_model
  const mapped = effective !== props.policy.requested_model
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  }

  return (
    <tr
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        'hover:bg-muted/30 border-t transition-colors',
        sortable.isDragging && 'bg-muted/60 relative z-10 shadow-sm'
      )}
    >
      <td className='w-10 p-2.5 pr-0'>
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          className='cursor-grab touch-none active:cursor-grabbing'
          disabled={dragDisabled}
          aria-label={t('Drag to reorder')}
          title={props.dragDisabledReason || t('Drag to reorder')}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical aria-hidden='true' />
        </Button>
      </td>
      <td className='p-2.5'>
        <PolicyChannelLink policy={props.policy} />
      </td>
      <td className='p-2.5 font-mono text-xs'>
        {mapped ? (
          <span title={`${props.policy.requested_model} → ${effective}`}>
            <span className='text-muted-foreground'>→ </span>
            {effective}
          </span>
        ) : (
          <span className='text-muted-foreground'>{effective || '—'}</span>
        )}
      </td>
      <td className='p-2.5'>
        <PriorityEditor
          policy={props.policy}
          groupPolicies={props.groupPolicies}
          disabled={props.busy}
          onChange={(value) => props.onPriorityChange(props.policy, value)}
        />
      </td>
      <td className='p-2.5'>
        <Badge variant={props.policy.enabled ? 'secondary' : 'outline'}>
          {props.policy.enabled ? t('Yes') : t('No')}
        </Badge>
      </td>
      <td className='p-2.5'>
        <Badge variant='outline' className='font-normal'>
          {policySourceLabel(props.policy.source, t)}
        </Badge>
      </td>
    </tr>
  )
}

export function PolicySortableGroup(props: PolicySortableGroupProps) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return
    const ordered = movePolicyWithinGroup(
      props.policies,
      Number(event.active.id),
      Number(event.over.id)
    )
    props.onReorder(ordered, Number(event.active.id))
  }

  return (
    <section className='overflow-hidden rounded-md border'>
      <div className='bg-muted/30 flex items-center justify-between border-b px-3 py-2'>
        <h3 className='font-mono text-sm font-medium'>
          {props.requestedModel}
        </h3>
        <span className='text-muted-foreground text-xs'>
          {t('{{count}} routes', { count: props.policies.length })}
        </span>
      </div>
      {props.dragDisabledReason && (
        <p className='border-b px-3 py-2 text-xs text-amber-600 dark:text-amber-400'>
          {props.dragDisabledReason}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={props.visiblePolicies.map((policy) => policy.channel_id)}
          strategy={verticalListSortingStrategy}
        >
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[760px] text-sm'>
              <thead className='bg-muted/20 text-left'>
                <tr>
                  <th className='w-10 p-2.5 pr-0' aria-label={t('Reorder')} />
                  <th className='text-muted-foreground p-2.5 font-medium'>
                    {t('Channel')}
                  </th>
                  <th className='text-muted-foreground p-2.5 font-medium'>
                    {t('Effective model')}
                  </th>
                  <th className='text-muted-foreground p-2.5 font-medium'>
                    {t('Priority')}
                  </th>
                  <th className='text-muted-foreground p-2.5 font-medium'>
                    {t('Enabled')}
                  </th>
                  <th className='text-muted-foreground p-2.5 font-medium'>
                    {t('Source')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {props.visiblePolicies.map((policy) => (
                  <SortablePolicyRow
                    key={policy.channel_id}
                    policy={policy}
                    groupPolicies={props.policies}
                    busy={props.busy}
                    dragDisabledReason={props.dragDisabledReason}
                    onPriorityChange={props.onPriorityChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
