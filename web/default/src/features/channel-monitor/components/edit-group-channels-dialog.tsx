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
import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { CHANNEL_STATUS } from '@/features/channels/constants'
import { cn } from '@/lib/utils'

import { updateChannelMonitorGroupChannels } from '../api'
import { handleChannelMonitorMutationError } from '../lib/error'
import type { ChannelMonitorItem, GroupMonitorItem } from '../types'

type EditGroupChannelsDialogProps = {
  group: GroupMonitorItem
  channels: ChannelMonitorItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditGroupChannelsDialog(props: EditGroupChannelsDialogProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const originalChannelIds = useMemo(
    () => new Set(props.group.channels.map((channel) => channel.id)),
    [props.group.channels]
  )
  const [selectedChannelIds, setSelectedChannelIds] = useState(
    () => new Set(originalChannelIds)
  )
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visibleChannels = useMemo(
    () =>
      [...props.channels]
        .filter((channel) => {
          if (!normalizedSearch) return true
          return (
            channel.name.toLocaleLowerCase().includes(normalizedSearch) ||
            String(channel.id).includes(normalizedSearch) ||
            channel.groups.some((group) =>
              group.toLocaleLowerCase().includes(normalizedSearch)
            )
          )
        })
        .sort((leftChannel, rightChannel) => {
          const leftIsMember = originalChannelIds.has(leftChannel.id)
          const rightIsMember = originalChannelIds.has(rightChannel.id)
          if (leftIsMember !== rightIsMember) return leftIsMember ? -1 : 1

          const leftEnabled = leftChannel.status === CHANNEL_STATUS.ENABLED
          const rightEnabled = rightChannel.status === CHANNEL_STATUS.ENABLED
          if (leftEnabled !== rightEnabled) return leftEnabled ? -1 : 1

          const nameOrder = leftChannel.name.localeCompare(rightChannel.name)
          return nameOrder !== 0 ? nameOrder : leftChannel.id - rightChannel.id
        }),
    [normalizedSearch, originalChannelIds, props.channels]
  )
  const lockedRemovalChannelIds = useMemo(
    () =>
      new Set(
        props.channels
          .filter(
            (channel) =>
              originalChannelIds.has(channel.id) &&
              channel.groups.every(
                (group) => !group || group === props.group.name
              )
          )
          .map((channel) => channel.id)
      ),
    [originalChannelIds, props.channels, props.group.name]
  )
  const tooLongToAddChannelIds = useMemo(
    () =>
      new Set(
        props.channels
          .filter((channel) => {
            const serializedGroups = [...channel.groups, props.group.name].join(
              ','
            )
            return (
              !originalChannelIds.has(channel.id) &&
              [...serializedGroups].length > 64
            )
          })
          .map((channel) => channel.id)
      ),
    [originalChannelIds, props.channels, props.group.name]
  )
  const addedCount = [...selectedChannelIds].filter(
    (channelId) => !originalChannelIds.has(channelId)
  ).length
  const removedCount = [...originalChannelIds].filter(
    (channelId) => !selectedChannelIds.has(channelId)
  ).length
  const hasChanges = addedCount > 0 || removedCount > 0

  const mutation = useMutation({
    mutationFn: updateChannelMonitorGroupChannels,
    onError: handleChannelMonitorMutationError,
    onSuccess: (response) => {
      const added = response.data.added_channel_ids.length
      const removed = response.data.removed_channel_ids.length
      toast.success(`分组渠道已更新：新增 ${added} 个，移除 ${removed} 个`)
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      props.onOpenChange(false)
    },
  })

  const setChannelSelected = (channelId: number, selected: boolean) => {
    if (!selected && lockedRemovalChannelIds.has(channelId)) return
    if (selected && tooLongToAddChannelIds.has(channelId)) return
    setSelectedChannelIds((current) => {
      const next = new Set(current)
      if (selected) {
        next.add(channelId)
      } else {
        next.delete(channelId)
      }
      return next
    })
  }

  const selectVisibleChannels = () => {
    setSelectedChannelIds((current) => {
      const next = new Set(current)
      for (const channel of visibleChannels) {
        if (!tooLongToAddChannelIds.has(channel.id)) next.add(channel.id)
      }
      return next
    })
  }

  const clearVisibleChannels = () => {
    setSelectedChannelIds((current) => {
      const next = new Set(current)
      for (const channel of visibleChannels) {
        if (!lockedRemovalChannelIds.has(channel.id)) next.delete(channel.id)
      }
      return next
    })
  }

  const saveChannels = () => {
    mutation.mutate({
      group: props.group.name,
      channelIds: [...selectedChannelIds].sort((left, right) => left - right),
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>管理分组渠道</DialogTitle>
          <DialogDescription>
            {props.group.name} · 这里只调整分组关联，不会删除渠道本身
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <InputGroup className='h-9 flex-1'>
              <InputGroupAddon>
                <HugeiconsIcon icon={Search01Icon} />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='搜索渠道、ID 或分组'
                aria-label='搜索渠道'
              />
            </InputGroup>
            <div className='flex gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={selectVisibleChannels}
                disabled={visibleChannels.length === 0 || mutation.isPending}
              >
                全选可见
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={clearVisibleChannels}
                disabled={visibleChannels.length === 0 || mutation.isPending}
              >
                清除可见
              </Button>
            </div>
          </div>

          <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
            <span>已选 {selectedChannelIds.size} 个渠道</span>
            {addedCount > 0 && (
              <Badge variant='secondary'>新增 {addedCount}</Badge>
            )}
            {removedCount > 0 && (
              <Badge variant='outline'>移除 {removedCount}</Badge>
            )}
          </div>

          <ScrollArea className='h-[min(420px,55vh)] rounded-lg border'>
            {visibleChannels.length === 0 ? (
              <div className='text-muted-foreground flex h-full min-h-40 items-center justify-center text-sm'>
                没有匹配的渠道
              </div>
            ) : (
              <div className='divide-y p-1'>
                {visibleChannels.map((channel) => {
                  const selected = selectedChannelIds.has(channel.id)
                  const removalLocked = lockedRemovalChannelIds.has(channel.id)
                  const tooLongToAdd = tooLongToAddChannelIds.has(channel.id)
                  const disabled =
                    mutation.isPending || removalLocked || tooLongToAdd
                  const otherGroups = channel.groups.filter(
                    (group) => group && group !== props.group.name
                  )
                  let membershipDescription =
                    otherGroups.length > 0
                      ? `其他分组：${otherGroups.join('、')}`
                      : '暂无其他分组'
                  let membershipDescriptionClassName =
                    'text-muted-foreground truncate text-xs'
                  if (removalLocked) {
                    membershipDescription = '唯一分组，请先为该渠道添加其他分组'
                    membershipDescriptionClassName =
                      'text-xs text-amber-600 dark:text-amber-400'
                  } else if (tooLongToAdd) {
                    membershipDescription =
                      '添加后关联分组名称合计将超过 64 个字符'
                    membershipDescriptionClassName = 'text-destructive text-xs'
                  }

                  return (
                    <label
                      key={channel.id}
                      className={cn(
                        'hover:bg-muted/60 flex items-start gap-3 rounded-md px-3 py-3 transition-colors',
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                      )}
                    >
                      <Checkbox
                        className='mt-0.5'
                        checked={selected}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          setChannelSelected(channel.id, checked)
                        }
                        aria-label={`${selected ? '从分组移除' : '添加到分组'}渠道 ${channel.name}`}
                      />
                      <div className='min-w-0 flex-1 space-y-1.5'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='truncate font-medium'>
                            {channel.name}
                          </span>
                          <span className='text-muted-foreground font-mono text-xs'>
                            ID {channel.id}
                          </span>
                          <Badge
                            variant={
                              channel.status === CHANNEL_STATUS.ENABLED
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {channel.status === CHANNEL_STATUS.ENABLED
                              ? '已启用'
                              : '已禁用'}
                          </Badge>
                          {originalChannelIds.has(channel.id) && (
                            <Badge variant='outline'>当前成员</Badge>
                          )}
                        </div>
                        <p className={membershipDescriptionClassName}>
                          {membershipDescription}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            type='button'
            onClick={saveChannels}
            disabled={!hasChanges || mutation.isPending}
          >
            {mutation.isPending && <Spinner data-icon='inline-start' />}
            保存关联
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
