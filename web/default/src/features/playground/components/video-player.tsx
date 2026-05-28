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
import { useRef, useState } from 'react'
import { CopyIcon, CheckIcon, XIcon, Maximize2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VideoTaskItem } from '../types'

interface VideoPlayerProps {
  task: VideoTaskItem
  onClose: () => void
}

export function VideoPlayer({ task, onClose }: VideoPlayerProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!task.videoUrl) return
    try {
      await navigator.clipboard.writeText(task.videoUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard errors
    }
  }

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.()
  }

  if (!task.videoUrl) return null

  return (
    <div className='border-border bg-background rounded-xl border shadow-sm'>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-2'>
        <div className='min-w-0 flex-1'>
          <p className='text-muted-foreground truncate text-xs font-medium'>
            {task.model}
          </p>
          <p className='truncate text-sm'>{task.prompt}</p>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            className={cn(
              'size-7',
              copied && 'text-green-500'
            )}
            size='icon'
            title={t('Copy URL')}
            aria-label={t('Copy URL')}
            type='button'
            variant='ghost'
            onClick={handleCopy}
          >
            {copied ? (
              <CheckIcon className='size-3.5' />
            ) : (
              <CopyIcon className='size-3.5' />
            )}
          </Button>
          <Button
            className='size-7'
            size='icon'
            title={t('Fullscreen')}
            aria-label={t('Fullscreen')}
            type='button'
            variant='ghost'
            onClick={handleFullscreen}
          >
            <Maximize2Icon className='size-3.5' />
          </Button>
          <Button
            className='size-7'
            size='icon'
            title={t('Close')}
            aria-label={t('Close')}
            type='button'
            variant='ghost'
            onClick={onClose}
          >
            <XIcon className='size-3.5' />
          </Button>
        </div>
      </div>

      {/* Video */}
      <div className='p-3'>
        <video
          ref={videoRef}
          className='w-full rounded-lg'
          controls
          playsInline
          src={task.videoUrl}
        >
          {t('Your browser does not support the video tag.')}
        </video>
      </div>

      {/* URL display */}
      <div className='border-t px-4 py-2'>
        <p className='text-muted-foreground truncate text-xs'>{task.videoUrl}</p>
      </div>
    </div>
  )
}
