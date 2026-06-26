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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadMediaFile } from '../../lib/download-media'
import { loadAuthenticatedMediaUrl, MediaLoadError } from '../../lib/load-authenticated-media'
import { MediaDialogFooter } from './media-dialog-footer'
import { RequestDataPanel } from './request-data-panel'

interface VideoDialogProps {
  videoUrl: string
  taskId?: string
  requestData?: Record<string, unknown> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VideoDialog({
  videoUrl,
  taskId,
  requestData,
  open,
  onOpenChange,
}: VideoDialogProps) {
  const { t } = useTranslation()
  const [playableUrl, setPlayableUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!open || !videoUrl) {
      setPlayableUrl('')
      return
    }

    let objectUrl: string | null = null
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setHasError(false)
      setErrorMessage('')
      try {
        const resolved = await loadAuthenticatedMediaUrl(videoUrl)
        if (cancelled) return
        if (resolved.revoke) {
          objectUrl = resolved.url
        }
        setPlayableUrl(resolved.url)
        setIsLoading(false)
      } catch (err) {
        if (!cancelled) {
          setPlayableUrl('')
          setHasError(true)
          setIsLoading(false)
          if (err instanceof MediaLoadError) {
            if (err.status === 410 || err.status === 404) {
              setErrorMessage(t('Video has expired or been removed from upstream storage'))
            } else {
              setErrorMessage(err.message)
            }
          } else {
            setErrorMessage(t('Failed to load video'))
          }
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [open, videoUrl])

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIsLoading(true)
      setHasError(false)
      setErrorMessage('')
      setPlayableUrl('')
    }
    onOpenChange(newOpen)
  }

  const handleDownload = async () => {
    if (!videoUrl || hasError || isDownloading) return
    setIsDownloading(true)
    try {
      await downloadMediaFile(videoUrl, 'generated-video.mp4')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='flex max-h-[min(88vh,640px)] flex-col gap-3 overflow-hidden sm:max-w-lg'>
        <DialogHeader className='shrink-0 gap-1.5'>
          <DialogTitle>{t('Video Preview')}</DialogTitle>
          {taskId ? (
            <div className='flex items-center gap-1.5'>
              <DialogDescription className='min-w-0 flex-1 truncate font-mono text-xs'>
                {t('Task ID:')} {taskId}
              </DialogDescription>
              <CopyButton
                value={taskId}
                variant='ghost'
                size='icon-sm'
                tooltip={t('Copy to clipboard')}
              />
            </div>
          ) : (
            <DialogDescription>{t('View the generated video')}</DialogDescription>
          )}
        </DialogHeader>

        <div className='min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5'>
          <div className='bg-muted/30 relative flex max-h-[min(32vh,260px)] min-h-[140px] items-center justify-center rounded-lg border p-2'>
            {(isLoading || hasError) && (
              <Skeleton className='absolute inset-2 rounded-md' />
            )}

            {playableUrl ? (
              <video
                key={playableUrl}
                src={playableUrl}
                controls
                className={`max-h-[min(32vh,240px)] max-w-full rounded-md ${
                  isLoading || hasError ? 'opacity-0' : 'opacity-100'
                }`}
                onLoadedData={() => {
                  setIsLoading(false)
                  setHasError(false)
                }}
                onError={() => {
                  setIsLoading(false)
                  setHasError(true)
                  setErrorMessage(t('Failed to load video'))
                }}
              />
            ) : null}

            {hasError && (
              <div className='absolute inset-0 flex items-center justify-center px-4 text-center'>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {errorMessage || t('Failed to load video')}
                </p>
              </div>
            )}
          </div>

          <p className='text-muted-foreground text-center text-xs'>
            {t('Generated images and videos are only kept for 3 days.')}
          </p>

          <MediaDialogFooter
            mediaUrl={videoUrl}
            disabled={isLoading || hasError}
            isDownloading={isDownloading}
            onDownload={() => void handleDownload()}
          />

          <RequestDataPanel data={requestData} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
