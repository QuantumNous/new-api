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
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getImageSource, isImageResultRenderable } from '../lib'
import type { ImageResult, ImageTask } from '../types'

interface PlaygroundImageTaskGridProps {
  tasks: ImageTask[]
  onReusePrompt: (prompt: string) => void
  onRetryTask: (task: ImageTask) => void
}

function IconButton({
  label,
  disabled,
  children,
  onClick,
}: {
  label: string
  disabled?: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={disabled}
            size='icon-sm'
            type='button'
            variant='ghost'
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

async function copyText(text: string, successMessage: string) {
  await navigator.clipboard.writeText(text)
  toast.success(successMessage)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function ImagePreview({
  image,
  task,
  index,
}: {
  image: ImageResult
  task: ImageTask
  index: number
}) {
  const { t } = useTranslation()
  const source = getImageSource(image, task.config)

  if (!source) {
    return (
      <div className='bg-muted flex aspect-square items-center justify-center rounded-lg text-muted-foreground'>
        <ImageIcon className='size-8' />
      </div>
    )
  }

  return (
    <img
      alt={t('Generated image {{index}}', { index: index + 1 })}
      className='aspect-square w-full rounded-lg object-cover'
      loading='lazy'
      src={source}
    />
  )
}

function TaskCard({
  task,
  onReusePrompt,
  onRetryTask,
}: {
  task: ImageTask
  onReusePrompt: (prompt: string) => void
  onRetryTask: (task: ImageTask) => void
}) {
  const { t } = useTranslation()
  const images = task.images.filter(isImageResultRenderable)
  const firstImage = images[0]
  const firstSource = firstImage ? getImageSource(firstImage, task.config) : ''
  const canCopyLink = Boolean(firstImage?.url)
  const canDownload = Boolean(firstSource)

  const handleCopyLink = () => {
    if (!firstImage?.url) return
    void copyText(firstImage.url, t('Image link copied'))
  }

  const handleDownload = () => {
    if (!firstSource) return
    if (firstSource.startsWith('data:')) {
      downloadDataUrl(
        firstSource,
        `${task.id}.${task.config.output_format || 'png'}`
      )
      return
    }
    window.open(firstSource, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className='rounded-lg py-3' size='sm'>
      <CardHeader className='gap-2 px-3'>
        <div className='flex items-start justify-between gap-2'>
          <p className='line-clamp-2 min-h-10 text-sm font-medium leading-5'>
            {task.prompt}
          </p>
          <span className='shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground'>
            {task.config.size}
          </span>
        </div>
      </CardHeader>

      <CardContent className='space-y-3 px-3'>
        {task.status === 'running' ? (
          <Skeleton className='aspect-square w-full rounded-lg' />
        ) : task.status === 'error' || task.status === 'interrupted' ? (
          <div className='border-border bg-muted/40 flex aspect-square flex-col items-center justify-center rounded-lg border p-4 text-center'>
            <ImageIcon className='mb-2 size-8 text-muted-foreground' />
            <p className='line-clamp-4 text-xs text-muted-foreground'>
              {task.error || t('Generation was interrupted')}
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {images.map((image, index) => (
              <ImagePreview
                image={image}
                index={index}
                key={`${task.id}-${index}`}
                task={task}
              />
            ))}
          </div>
        )}

        {firstImage?.revised_prompt ? (
          <p className='line-clamp-2 text-xs text-muted-foreground'>
            {firstImage.revised_prompt}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className='justify-between gap-2 rounded-b-lg px-3 py-2'>
        <span className='truncate text-xs text-muted-foreground'>
          {task.status === 'running'
            ? t('Generating')
            : task.status === 'done'
              ? t('{{count}} image(s)', { count: images.length })
              : task.errorCode || t('Error')}
        </span>
        <div className='flex shrink-0 items-center gap-1'>
          <IconButton
            disabled={!canCopyLink}
            label={t('Copy image link')}
            onClick={handleCopyLink}
          >
            <CopyIcon className='size-4' />
          </IconButton>
          <IconButton
            disabled={!canDownload}
            label={t('Download image')}
            onClick={handleDownload}
          >
            <DownloadIcon className='size-4' />
          </IconButton>
          <IconButton
            label={t('Reuse prompt')}
            onClick={() => onReusePrompt(task.prompt)}
          >
            <RotateCcwIcon className='size-4' />
          </IconButton>
          <IconButton label={t('Retry')} onClick={() => onRetryTask(task)}>
            <RefreshCwIcon className='size-4' />
          </IconButton>
        </div>
      </CardFooter>
    </Card>
  )
}

export function PlaygroundImageTaskGrid({
  tasks,
  onReusePrompt,
  onRetryTask,
}: PlaygroundImageTaskGridProps) {
  const { t } = useTranslation()

  if (tasks.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center px-4 py-10'>
        <div className='text-center text-muted-foreground'>
          <ImageIcon className='mx-auto mb-3 size-9' />
          <p className='text-sm'>{t('No generated images yet')}</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delay={300}>
      <div className='grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3'>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onReusePrompt={onReusePrompt}
            onRetryTask={onRetryTask}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}
