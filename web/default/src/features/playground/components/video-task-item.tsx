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
import { PlayIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  QueueItem,
  QueueItemContent,
  QueueItemActions,
  QueueItemAction,
} from '@/components/ai-elements/queue'
import { VIDEO_MODEL_TYPE_LABELS } from '../constants'
import type { VideoTaskItem as VideoTaskItemType } from '../types'

interface VideoTaskItemProps {
  task: VideoTaskItemType
  onPreview: (task: VideoTaskItemType) => void
  onRemove: (id: string) => void
}

const STATUS_COLORS: Record<VideoTaskItemType['status'], string> = {
  queued: 'bg-muted-foreground/40',
  in_progress: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-destructive',
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function VideoTaskItem({ task, onPreview, onRemove }: VideoTaskItemProps) {
  const { t } = useTranslation()

  return (
    <QueueItem>
      <div className='flex items-start gap-2'>
        {/* Status indicator dot */}
        <span
          className={cn(
            'mt-1.5 inline-block size-2.5 shrink-0 rounded-full',
            STATUS_COLORS[task.status]
          )}
        />
        <div className='min-w-0 flex-1'>
          {/* Model name + type badge + time */}
          <div className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-1.5'>
              {task.type && (
                <Badge variant='secondary' className='h-4 px-1 text-[10px]'>
                  {VIDEO_MODEL_TYPE_LABELS[task.type]}
                </Badge>
              )}
              <span className='text-muted-foreground truncate text-xs font-medium'>
                {task.model}
              </span>
            </div>
            <span className='text-muted-foreground/60 shrink-0 text-xs'>
              {formatTime(task.createdAt)}
            </span>
          </div>
          {/* Prompt preview */}
          <QueueItemContent className='text-foreground/80 mt-0.5 text-xs'>
            {task.prompt}
          </QueueItemContent>
          {/* Resolution / Duration metadata */}
          {(task.size || task.duration) && (
            <p className='text-muted-foreground/60 mt-0.5 text-[10px]'>
              {[task.size, task.duration ? `${task.duration}s` : '']
                .filter(Boolean)
                .join(' / ')}
            </p>
          )}
          {/* Progress bar for in_progress */}
          {task.status === 'in_progress' && (
            <Progress className='mt-1.5 h-1' value={task.progress} />
          )}
          {/* Error message */}
          {task.status === 'failed' && task.error && (
            <p className='text-destructive mt-1 text-xs'>{task.error}</p>
          )}
        </div>
        {/* Actions */}
        <QueueItemActions>
          {task.status === 'completed' && task.videoUrl && (
            <QueueItemAction
              title={t('Preview')}
              onClick={() => onPreview(task)}
            >
              <PlayIcon className='size-3.5' />
            </QueueItemAction>
          )}
          <QueueItemAction
            title={t('Remove')}
            onClick={() => onRemove(task.id)}
          >
            <Trash2Icon className='size-3.5' />
          </QueueItemAction>
        </QueueItemActions>
      </div>
    </QueueItem>
  )
}
