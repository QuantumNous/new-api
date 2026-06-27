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
import { Loader2 } from 'lucide-react'
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
import { isValidMediaPreviewURL } from '../../lib/media-preview'
import { downloadMediaFile } from '../../lib/download-media'
import { MediaDialogFooter } from './media-dialog-footer'
import { RequestDataPanel } from './request-data-panel'

interface ImageDialogProps {
  imageUrl: string
  taskId?: string
  errorMessage?: string
  errorCode?: string
  requestData?: Record<string, unknown> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImageDialog({
  imageUrl,
  taskId,
  errorMessage,
  errorCode,
  requestData,
  open,
  onOpenChange,
}: ImageDialogProps) {
  const { t } = useTranslation()
  const hasValidUrl = isValidMediaPreviewURL(imageUrl)
  const [isLoading, setIsLoading] = useState(hasValidUrl)
  const [hasError, setHasError] = useState(!hasValidUrl)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!open) return
    setIsLoading(hasValidUrl)
    setHasError(!hasValidUrl)
  }, [open, imageUrl, hasValidUrl])

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIsLoading(hasValidUrl)
      setHasError(!hasValidUrl)
    }
    onOpenChange(newOpen)
  }

  const handleImageLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const handleDownload = async () => {
    if (!hasValidUrl || hasError || isDownloading) return
    setIsDownloading(true)
    try {
      await downloadMediaFile(imageUrl, 'generated-image.png')
    } finally {
      setIsDownloading(false)
    }
  }

  const failureText =
    errorMessage ||
    (hasError && !hasValidUrl ? t('Image generation failed') : t('Failed to load image'))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='flex max-h-[min(88vh,640px)] flex-col gap-3 overflow-hidden sm:max-w-lg'>
        <DialogHeader className='shrink-0 gap-1.5'>
          <DialogTitle>{t('Image Preview')}</DialogTitle>
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
            <DialogDescription>{t('View the generated image')}</DialogDescription>
          )}
        </DialogHeader>

        <div className='min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5'>
          <div className='bg-muted/30 relative flex max-h-[min(32vh,260px)] min-h-[140px] items-center justify-center rounded-lg border p-2'>
            {hasValidUrl ? (
              <>
                {isLoading && !hasError && (
                  <Skeleton className='absolute inset-2 rounded-md' />
                )}

                {isLoading && !hasError && (
                  <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4'>
                    <Loader2 className='text-muted-foreground size-6 animate-spin' />
                    <p className='text-muted-foreground text-sm'>{t('Loading image...')}</p>
                  </div>
                )}

                <img
                  key={imageUrl}
                  src={imageUrl}
                  alt={t('Generated image')}
                  className={`max-h-[min(32vh,240px)] max-w-full rounded-md object-contain ${
                    isLoading || hasError ? 'opacity-0' : 'opacity-100'
                  }`}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />

                {hasError && (
                  <div className='absolute inset-0 z-10 flex items-center justify-center px-4 text-center'>
                    <p className='text-muted-foreground text-sm'>{failureText}</p>
                  </div>
                )}
              </>
            ) : (
              <div className='space-y-2 px-4 text-center'>
                <p className='text-destructive text-sm leading-relaxed break-words'>
                  {failureText}
                </p>
                {errorCode ? (
                  <p className='text-muted-foreground font-mono text-xs'>{errorCode}</p>
                ) : null}
              </div>
            )}
          </div>

          {hasValidUrl ? (
            <>
              <p className='text-muted-foreground text-center text-xs'>
                {t('Generated images and videos are only kept for 3 days.')}
              </p>

              <MediaDialogFooter
                mediaUrl={imageUrl}
                disabled={isLoading || hasError}
                isDownloading={isDownloading}
                onDownload={() => void handleDownload()}
              />
            </>
          ) : null}

          <RequestDataPanel data={requestData} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
