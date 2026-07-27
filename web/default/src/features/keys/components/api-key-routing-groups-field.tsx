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
  Check,
  ChevronsUpDown,
  CircleDollarSign,
  GripVertical,
  Route,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Reorder, useDragControls } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { MAX_GROUP_CANDIDATES, SYSTEM_ROUTING_VALUE } from '../lib'

export type ApiKeyRoutingGroupOption = {
  value: string
  label: string
  desc?: string
  ratio?: number | string
}

type ApiKeyRoutingGroupsFieldProps = {
  allowSystemRouting: boolean
  isLoadingModels: boolean
  modelsByGroup: Record<string, string[]>
  onValueChange: (value: string[]) => void
  options: ApiKeyRoutingGroupOption[]
  value: string[]
}

function isSpecialGroup(group: string) {
  return group === SYSTEM_ROUTING_VALUE
}

function GroupRatioBadge(props: { ratio?: number | string }) {
  if (props.ratio === undefined || props.ratio === '') return null

  return (
    <Badge variant='outline' className='shrink-0 tabular-nums'>
      {props.ratio}x
    </Badge>
  )
}

type RoutingGroupRowProps = {
  group: string
  index: number
  isLoadingModels: boolean
  modelCount: number
  onMove: (index: number, direction: -1 | 1) => void
  onMoveTo: (group: string, targetIndex: number) => void
  onRemove: (group: string) => void
  option?: ApiKeyRoutingGroupOption
  total: number
}

function RoutingGroupRow(props: RoutingGroupRowProps) {
  const { t } = useTranslation()
  const dragControls = useDragControls()
  const [isDragging, setIsDragging] = useState(false)
  const groupLabel = props.option?.label ?? props.group
  const canReorder = props.total > 1 && !isSpecialGroup(props.group)
  const orderLabel = t('Order for {{group}}', { group: groupLabel })

  return (
    <Reorder.Item
      as='div'
      value={props.group}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      whileDrag={{
        scale: 1.025,
        zIndex: 20,
        boxShadow:
          '0 18px 36px rgb(0 0 0 / 0.2), 0 0 0 3px color-mix(in oklch, var(--primary) 35%, transparent)',
      }}
      className={cn(
        'bg-muted/30 relative grid min-h-16 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-2 transition-[border-color,background-color,box-shadow] sm:gap-3 sm:px-3',
        isDragging &&
          'border-primary bg-background ring-primary/30 cursor-grabbing shadow-xl ring-2'
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type='button'
              variant='outline'
              size='icon-sm'
              disabled={!canReorder}
              className='border-primary/25 bg-background hover:border-primary hover:bg-primary/10 hover:text-primary size-10 cursor-grab touch-none shadow-sm active:cursor-grabbing disabled:cursor-default sm:size-8'
              aria-label={t('Drag to reorder {{group}}', {
                group: groupLabel,
              })}
              onPointerDown={(event) => {
                if (!canReorder) return
                if (event.pointerType === 'mouse' && event.button !== 0) return
                dragControls.start(event)
              }}
              onKeyDown={(event) => {
                if (!canReorder) return
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  props.onMove(props.index, -1)
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  props.onMove(props.index, 1)
                }
              }}
            />
          }
        >
          <GripVertical className='size-5' aria-hidden='true' />
        </TooltipTrigger>
        <TooltipContent>
          {t('Drag to reorder {{group}}', { group: groupLabel })}
        </TooltipContent>
      </Tooltip>

      <Input
        type='number'
        min={1}
        max={props.total}
        value={props.index + 1}
        disabled={!canReorder}
        aria-label={orderLabel}
        title={orderLabel}
        className='h-9 w-14 px-1 text-center font-semibold tabular-nums sm:h-8 sm:w-12'
        onChange={(event) => {
          const priority = Number.parseInt(event.target.value, 10)
          if (
            !canReorder ||
            !Number.isInteger(priority) ||
            priority < 1 ||
            priority > props.total
          ) {
            return
          }
          props.onMoveTo(props.group, priority - 1)
        }}
      />

      <div className='min-w-0'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <span className='truncate font-medium'>{groupLabel}</span>
          <GroupRatioBadge ratio={props.option?.ratio} />
        </div>
        <div className='text-muted-foreground mt-0.5 flex items-center gap-2 text-xs'>
          {props.option?.desc && (
            <span className='truncate'>{props.option.desc}</span>
          )}
          {!isSpecialGroup(props.group) && props.isLoadingModels && (
            <Skeleton className='h-3 w-16' />
          )}
          {!isSpecialGroup(props.group) && !props.isLoadingModels && (
            <span className='shrink-0'>
              {t('{{count}} models', { count: props.modelCount })}
            </span>
          )}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className='size-10 sm:size-7'
              aria-label={t('Remove {{group}}', { group: groupLabel })}
              onClick={() => props.onRemove(props.group)}
            />
          }
        >
          <Trash2 aria-hidden='true' />
        </TooltipTrigger>
        <TooltipContent>{t('Remove')}</TooltipContent>
      </Tooltip>
    </Reorder.Item>
  )
}

export function ApiKeyRoutingGroupsField(props: ApiKeyRoutingGroupsFieldProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [announcement, setAnnouncement] = useState('')

  const options = useMemo(() => {
    const specialOptions: ApiKeyRoutingGroupOption[] = []
    if (props.allowSystemRouting) {
      specialOptions.push({
        value: SYSTEM_ROUTING_VALUE,
        label: t('System-managed routing'),
        desc: t('Follow the group order maintained by the administrator'),
      })
    }
    return [...specialOptions, ...props.options]
  }, [props.allowSystemRouting, props.options, t])

  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  )

  const filteredOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return options

    return options.filter((option) => {
      const searchable = [
        option.value,
        option.label,
        option.desc ?? '',
        String(option.ratio ?? ''),
      ]
        .join(' ')
        .toLowerCase()
      return searchable.includes(search)
    })
  }, [options, searchValue])

  const conflicts = useMemo(() => {
    const modelGroups = new Map<string, string[]>()
    for (const group of props.value) {
      if (isSpecialGroup(group)) continue
      for (const model of props.modelsByGroup[group] ?? []) {
        const groups = modelGroups.get(model) ?? []
        groups.push(group)
        modelGroups.set(model, groups)
      }
    }
    return [...modelGroups.entries()].filter(([, groups]) => groups.length > 1)
  }, [props.modelsByGroup, props.value])

  const firstConflict = conflicts[0]

  const handleSelect = (selectedValue: string) => {
    if (isSpecialGroup(selectedValue)) {
      props.onValueChange([selectedValue])
      setOpen(false)
      setSearchValue('')
      return
    }

    const concreteGroups = props.value.filter((group) => !isSpecialGroup(group))
    if (concreteGroups.includes(selectedValue)) {
      props.onValueChange(
        concreteGroups.filter((group) => group !== selectedValue)
      )
      return
    }
    if (concreteGroups.length >= MAX_GROUP_CANDIDATES) return

    props.onValueChange([...concreteGroups, selectedValue])
  }

  const moveGroup = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= props.value.length) return

    const next = [...props.value]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    props.onValueChange(next)
    const groupLabel =
      optionByValue.get(next[nextIndex])?.label ?? next[nextIndex]
    setAnnouncement(
      t('{{group}} is now priority {{priority}}', {
        group: groupLabel,
        priority: nextIndex + 1,
      })
    )
  }

  const moveGroupTo = (sourceGroup: string, targetIndex: number) => {
    const sourceIndex = props.value.indexOf(sourceGroup)
    if (
      sourceIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= props.value.length ||
      sourceIndex === targetIndex
    ) {
      return
    }

    const next = [...props.value]
    const [movedGroup] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, movedGroup)
    props.onValueChange(next)
    const groupLabel = optionByValue.get(movedGroup)?.label ?? movedGroup
    setAnnouncement(
      t('{{group}} is now priority {{priority}}', {
        group: groupLabel,
        priority: targetIndex + 1,
      })
    )
  }

  const removeGroup = (group: string) => {
    props.onValueChange(props.value.filter((item) => item !== group))
  }

  return (
    <div className='flex flex-col gap-3'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type='button'
              variant='outline'
              role='combobox'
              aria-expanded={open}
              className='h-10 w-full justify-between px-3'
            />
          }
        >
          <span className='text-muted-foreground truncate'>
            {t('Search and add groups')}
          </span>
          <span className='flex shrink-0 items-center gap-2'>
            <Badge variant='secondary'>
              {t('{{count}} selected', { count: props.value.length })}
            </Badge>
            <ChevronsUpDown aria-hidden='true' />
          </span>
        </PopoverTrigger>
        <PopoverContent
          className='w-[var(--anchor-width)] overflow-hidden p-0'
          onWheel={(event) => event.stopPropagation()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={searchValue}
              onValueChange={setSearchValue}
              placeholder={t('Search groups...')}
            />
            <CommandList className='max-h-80'>
              <CommandEmpty>{t('No group found.')}</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const selected = props.value.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className='items-start gap-3 px-3 py-3'
                    >
                      <Check
                        className={cn(
                          'mt-0.5',
                          selected ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden='true'
                      />
                      <span className='min-w-0 flex-1'>
                        <span className='block truncate font-medium'>
                          {option.label}
                        </span>
                        {option.desc && (
                          <span className='text-muted-foreground block truncate text-xs'>
                            {option.desc}
                          </span>
                        )}
                      </span>
                      <GroupRatioBadge ratio={option.ratio} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Reorder.Group
        as='div'
        axis='y'
        values={props.value}
        onReorder={props.onValueChange}
        className='flex flex-col gap-2'
      >
        {props.value.map((group, index) => (
          <RoutingGroupRow
            key={group}
            group={group}
            index={index}
            total={props.value.length}
            option={optionByValue.get(group)}
            modelCount={props.modelsByGroup[group]?.length ?? 0}
            isLoadingModels={props.isLoadingModels}
            onMove={moveGroup}
            onMoveTo={moveGroupTo}
            onRemove={removeGroup}
          />
        ))}
      </Reorder.Group>

      <span className='sr-only' aria-live='polite'>
        {announcement}
      </span>

      {firstConflict && (
        <Alert role='status'>
          <TriangleAlert aria-hidden='true' />
          <AlertTitle>
            {t('{{count}} models appear in multiple groups', {
              count: conflicts.length,
            })}
          </AlertTitle>
          <AlertDescription>
            <span className='block'>
              {t(
                'The first group is used first; retryable failures follow the order below.'
              )}
            </span>
            <span className='mt-1 flex flex-wrap items-center gap-1 font-mono text-xs'>
              <span>{firstConflict[0]}:</span>
              {firstConflict[1].map((group, index) => (
                <span key={group} className='inline-flex items-center gap-1'>
                  {index > 0 && <span aria-hidden='true'>-&gt;</span>}
                  <span>{optionByValue.get(group)?.label ?? group}</span>
                  <GroupRatioBadge ratio={optionByValue.get(group)?.ratio} />
                </span>
              ))}
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Alert role='status'>
        {props.value.length > 1 ? (
          <Route aria-hidden='true' />
        ) : (
          <CircleDollarSign aria-hidden='true' />
        )}
        <AlertTitle>{t('Billing follows the successful group')}</AlertTitle>
        <AlertDescription>
          {t(
            'This API Key shares one quota balance. Each successful request uses the multiplier of the group that served it.'
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
