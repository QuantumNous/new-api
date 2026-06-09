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
import { useState } from 'react'
import {
  AlertCircleIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  onDeleteTask: (taskId: string) => void
}

function IconButton({
  label,
  className,
  disabled,
  children,
  onClick,
}: {
  label: string
  className?: string
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
            className={className}
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

interface ImagePreviewSelection {
  alt: string
  source: string
}

const imageResultClassName =
  'flex aspect-square w-full items-center justify-center overflow-hidden rounded-md'

function EmptyImageSlot() {
  return (
    <div className={`${imageResultClassName} bg-muted text-muted-foreground`}>
      <ImageIcon className='size-8' />
    </div>
  )
}

function ImagePreview({
  image,
  task,
  onOpen,
}: {
  image: ImageResult
  task: ImageTask
  onOpen: (preview: ImagePreviewSelection) => void
}) {
  const { t } = useTranslation()
  const source = getImageSource(image, task.config)
  const alt = t('Generated image')

  if (!source) {
    return <EmptyImageSlot />
  }

  return (
    <button
      aria-label={alt}
      className={`group focus-visible:ring-ring/50 ${imageResultClassName} outline-none focus-visible:ring-3`}
      type='button'
      onClick={() => onOpen({ alt, source })}
    >
      <img
        alt={alt}
        className='size-full object-cover transition-transform duration-150 group-hover:scale-[1.02]'
        loading='lazy'
        src={source}
      />
    </button>
  )
}

function TaskCard({
  task,
  onReusePrompt,
  onRetryTask,
  onDeleteTask,
  onPreviewImage,
}: {
  task: ImageTask
  onReusePrompt: (prompt: string) => void
  onRetryTask: (task: ImageTask) => void
  onDeleteTask: (taskId: string) => void
  onPreviewImage: (preview: ImagePreviewSelection) => void
}) {
  const { t } = useTranslation()
  const firstImage =
    task.image && isImageResultRenderable(task.image) ? task.image : undefined
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
    <Card className='overflow-hidden rounded-lg py-0' size='sm'>
      <CardHeader className='gap-2 px-3 py-3'>
        <div className='flex items-start justify-between gap-2'>
          <p className='line-clamp-2 text-sm leading-5 font-medium'>
            {task.prompt}
          </p>
          <span className='bg-muted text-muted-foreground shrink-0 rounded-md px-2 py-1 text-xs'>
            {task.config.size}
          </span>
        </div>
      </CardHeader>

      <CardContent className='space-y-3 px-3 pb-3'>
        {task.status === 'running' ? (
          <Skeleton className='aspect-square w-full rounded-md' />
        ) : task.status === 'error' || task.status === 'interrupted' ? (
          <div
            className={`${imageResultClassName} border-border bg-muted/40 flex-col border border-dashed px-4 py-5 text-center`}
          >
            <AlertCircleIcon className='text-muted-foreground mb-2 size-7 shrink-0' />
            <p className='text-muted-foreground line-clamp-4 max-w-full text-xs leading-5 break-words'>
              {task.error || t('Generation was interrupted')}
            </p>
          </div>
        ) : !firstImage ? (
          <EmptyImageSlot />
        ) : (
          <ImagePreview
            image={firstImage}
            task={task}
            onOpen={onPreviewImage}
          />
        )}
      </CardContent>

      <CardFooter className='bg-muted/25 justify-between gap-2 border-t px-3 py-2'>
        <span className='text-muted-foreground truncate text-xs'>
          {task.status === 'running'
            ? t('Generating')
            : task.status === 'done'
              ? t('Generated image')
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
          <IconButton
            className='text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20'
            label={t('Delete')}
            onClick={() => onDeleteTask(task.id)}
          >
            <Trash2Icon className='size-4' />
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
  onDeleteTask,
}: PlaygroundImageTaskGridProps) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<ImagePreviewSelection | null>(null)

  if (tasks.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center px-4 py-10'>
        <div className='text-muted-foreground text-center'>
          <ImageIcon className='mx-auto mb-3 size-9' />
          <p className='text-sm'>{t('No generated images yet')}</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delay={300}>
      <>
        <div className='mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-4 p-4 pb-28 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onReusePrompt={onReusePrompt}
              onRetryTask={onRetryTask}
              onDeleteTask={onDeleteTask}
              onPreviewImage={setPreview}
            />
          ))}
        </div>

        <Dialog
          open={Boolean(preview)}
          onOpenChange={(open) => {
            if (!open) setPreview(null)
          }}
        >
          <DialogContent className='bg-background/95 w-auto max-w-[calc(100vw-1rem)] p-2 sm:max-w-[min(92vw,90rem)]'>
            <DialogHeader className='sr-only'>
              <DialogTitle>
                {preview?.alt || t('Generated image')}
              </DialogTitle>
            </DialogHeader>
            <div className='flex max-h-[85vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-lg bg-black/90'>
              {preview ? (
                <img
                  alt={preview.alt}
                  className='max-h-[85vh] max-w-[90vw] object-contain'
                  src={preview.source}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  )
}
