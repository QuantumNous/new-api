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
import { FilmIcon, Trash2Icon } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
} from '@/components/ai-elements/queue'
import { VIDEO_MODEL_TYPE_LABELS } from '../constants'
import { VideoTaskItem } from './video-task-item'
import type { VideoTaskItem as VideoTaskItemType, VideoModelType } from '../types'

interface VideoTaskQueueProps {
  tasks: VideoTaskItemType[]
  onPreview: (task: VideoTaskItemType) => void
  onRemove: (id: string) => void
  onClearFinished: () => void
}

export function VideoTaskQueue({
  tasks,
  onPreview,
  onRemove,
  onClearFinished,
}: VideoTaskQueueProps) {
  const { t } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Collect unique types present in tasks for filter tabs
  const availableTypes = useMemo(() => {
    const types = new Set<VideoModelType>()
    for (const task of tasks) {
      if (task.type) types.add(task.type)
    }
    return Array.from(types)
  }, [tasks])

  const filteredTasks = useMemo(
    () =>
      typeFilter === 'all'
        ? tasks
        : tasks.filter((t) => t.type === typeFilter),
    [tasks, typeFilter]
  )

  const activeTasks = filteredTasks.filter(
    (t) => t.status === 'queued' || t.status === 'in_progress'
  )
  const finishedTasks = filteredTasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed'
  )

  if (tasks.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-sm'>
        <FilmIcon className='size-8 opacity-40' />
        <p>{t('No video tasks yet')}</p>
        <p className='text-xs'>{t('Submit a task to see it here')}</p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {/* Type filter tabs */}
      {availableTypes.length > 1 && (
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList variant='line'>
            <TabsTrigger value='all'>
              {t('All')}
            </TabsTrigger>
            {availableTypes.map((type) => (
              <TabsTrigger key={type} value={type}>
                {VIDEO_MODEL_TYPE_LABELS[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <Queue>
          <QueueSection defaultOpen>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={activeTasks.length}
                icon={<FilmIcon className='size-3.5' />}
                label={t('In Progress')}
              />
            </QueueSectionTrigger>
            <QueueSectionContent>
              <ScrollArea>
                <div className='max-h-64 pr-1'>
                  <ul className='flex flex-col gap-1 py-1'>
                    {activeTasks.map((task) => (
                      <VideoTaskItem
                        key={task.id}
                        task={task}
                        onPreview={onPreview}
                        onRemove={onRemove}
                      />
                    ))}
                  </ul>
                </div>
              </ScrollArea>
            </QueueSectionContent>
          </QueueSection>
        </Queue>
      )}

      {/* Finished tasks */}
      {finishedTasks.length > 0 && (
        <Queue>
          <QueueSection defaultOpen>
            <QueueSectionTrigger>
              <QueueSectionLabel
                count={finishedTasks.length}
                icon={<FilmIcon className='size-3.5' />}
                label={t('Completed')}
              />
              <Button
                className='text-muted-foreground hover:text-foreground ml-auto h-auto p-1 text-xs'
                size='icon'
                type='button'
                variant='ghost'
                title={t('Clear finished tasks')}
                aria-label={t('Clear finished tasks')}
                onClick={(e) => {
                  e.stopPropagation()
                  onClearFinished()
                }}
              >
                <Trash2Icon className='size-3.5' />
              </Button>
            </QueueSectionTrigger>
            <QueueSectionContent>
              <ScrollArea>
                <div className='max-h-64 pr-1'>
                  <ul className='flex flex-col gap-1 py-1'>
                    {finishedTasks.map((task) => (
                      <VideoTaskItem
                        key={task.id}
                        task={task}
                        onPreview={onPreview}
                        onRemove={onRemove}
                      />
                    ))}
                  </ul>
                </div>
              </ScrollArea>
            </QueueSectionContent>
          </QueueSection>
        </Queue>
      )}
    </div>
  )
}
