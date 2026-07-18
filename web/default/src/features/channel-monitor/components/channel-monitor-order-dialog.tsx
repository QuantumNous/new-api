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
  ArrowDown01Icon,
  ArrowUp01Icon,
  DragDropVerticalIcon,
  Refresh01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type DragEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

import { updateChannelMonitorChannelOrder } from '../api'
import { orderChannelsByCustomOrder } from '../lib/sort'
import type { ChannelMonitorItem } from '../types'

type ChannelMonitorOrderDialogProps = {
  channels: ChannelMonitorItem[]
  channelOrder: number[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

type DropPosition = 'before' | 'after'

function reorderChannels(
  channels: ChannelMonitorItem[],
  sourceId: number,
  targetId: number,
  position: DropPosition
) {
  if (sourceId === targetId) return channels
  const sourceChannel = channels.find((channel) => channel.id === sourceId)
  if (!sourceChannel) return channels

  const reorderedChannels = channels.filter(
    (channel) => channel.id !== sourceId
  )
  let targetIndex = reorderedChannels.findIndex(
    (channel) => channel.id === targetId
  )
  if (targetIndex < 0) return channels
  if (position === 'after') targetIndex += 1
  reorderedChannels.splice(targetIndex, 0, sourceChannel)
  return reorderedChannels
}

export function ChannelMonitorOrderDialog(
  props: ChannelMonitorOrderDialogProps
) {
  const queryClient = useQueryClient()
  const [orderedChannels, setOrderedChannels] = useState(() =>
    orderChannelsByCustomOrder(props.channels, props.channelOrder)
  )
  const [draggedChannelId, setDraggedChannelId] = useState<number | null>(null)
  const [dragOverChannelId, setDragOverChannelId] = useState<number | null>(
    null
  )
  const [dropPosition, setDropPosition] = useState<DropPosition>('before')
  const mutation = useMutation({
    mutationFn: updateChannelMonitorChannelOrder,
    onSuccess: () => {
      toast.success('渠道自定义顺序已保存')
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      props.onOpenChange(false)
    },
  })

  const resetDragState = () => {
    setDraggedChannelId(null)
    setDragOverChannelId(null)
    setDropPosition('before')
  }

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    channelId: number
  ) => {
    setDraggedChannelId(channelId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(channelId))
  }

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    channelId: number
  ) => {
    event.preventDefault()
    if (draggedChannelId == null || draggedChannelId === channelId) return
    const rect = event.currentTarget.getBoundingClientRect()
    setDragOverChannelId(channelId)
    setDropPosition(
      event.clientY - rect.top > rect.height / 2 ? 'after' : 'before'
    )
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, channelId: number) => {
    event.preventDefault()
    const sourceId = Number(
      draggedChannelId ?? event.dataTransfer.getData('text/plain')
    )
    if (Number.isInteger(sourceId) && sourceId > 0) {
      setOrderedChannels((channels) =>
        reorderChannels(channels, sourceId, channelId, dropPosition)
      )
    }
    resetDragState()
  }

  const moveChannel = (channelId: number, offset: -1 | 1) => {
    setOrderedChannels((channels) => {
      const sourceIndex = channels.findIndex(
        (channel) => channel.id === channelId
      )
      const targetIndex = sourceIndex + offset
      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= channels.length
      ) {
        return channels
      }
      const reorderedChannels = [...channels]
      const targetChannel = reorderedChannels[targetIndex]
      reorderedChannels[targetIndex] = reorderedChannels[sourceIndex]
      reorderedChannels[sourceIndex] = targetChannel
      return reorderedChannels
    })
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>自定义渠道顺序</DialogTitle>
          <DialogDescription>
            拖动渠道或使用上下按钮调整顺序。该顺序仅影响渠道监控页面，不会修改渠道优先级和路由策略。
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[60vh] space-y-2 overflow-y-auto pr-1'>
          {orderedChannels.map((channel, index) => {
            const isDragging = channel.id === draggedChannelId
            const isDropTarget =
              channel.id === dragOverChannelId &&
              draggedChannelId != null &&
              draggedChannelId !== channel.id
            return (
              <div
                key={channel.id}
                onDragOver={(event) => handleDragOver(event, channel.id)}
                onDrop={(event) => handleDrop(event, channel.id)}
                className={cn(
                  'bg-card flex items-center gap-3 rounded-lg border p-2.5 transition-colors',
                  isDragging && 'opacity-50',
                  isDropTarget &&
                    dropPosition === 'before' &&
                    'border-t-primary border-t-2',
                  isDropTarget &&
                    dropPosition === 'after' &&
                    'border-b-primary border-b-2'
                )}
              >
                <button
                  type='button'
                  draggable={orderedChannels.length > 1}
                  onDragStart={(event) => handleDragStart(event, channel.id)}
                  onDragEnd={resetDragState}
                  className='text-muted-foreground hover:text-foreground flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing'
                  aria-label={`拖动渠道 ${channel.name}`}
                >
                  <HugeiconsIcon icon={DragDropVerticalIcon} />
                </button>
                <span className='bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums'>
                  {index + 1}
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {channel.name}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    ID {channel.id}
                  </div>
                </div>
                <div className='flex shrink-0 gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => moveChannel(channel.id, -1)}
                    disabled={index === 0 || mutation.isPending}
                    aria-label={`上移渠道 ${channel.name}`}
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => moveChannel(channel.id, 1)}
                    disabled={
                      index === orderedChannels.length - 1 || mutation.isPending
                    }
                    aria-label={`下移渠道 ${channel.name}`}
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className='flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <Button
            type='button'
            variant='ghost'
            onClick={() => setOrderedChannels([...props.channels])}
            disabled={mutation.isPending}
          >
            <HugeiconsIcon icon={Refresh01Icon} data-icon='inline-start' />
            恢复默认顺序
          </Button>
          <div className='flex justify-end gap-2'>
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
              onClick={() =>
                mutation.mutate(orderedChannels.map((channel) => channel.id))
              }
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Spinner data-icon='inline-start' />}
              保存顺序
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
