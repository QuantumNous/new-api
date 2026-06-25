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
import { MediaDialogFooter } from './media-dialog-footer'
import { RequestDataPanel } from './request-data-panel'

interface ImageDialogProps {
  imageUrl: string
  taskId?: string
  requestData?: Record<string, unknown> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImageDialog({
  imageUrl,
  taskId,
  requestData,
  open,
  onOpenChange,
}: ImageDialogProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIsLoading(true)
      setHasError(false)
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
    if (!imageUrl || hasError || isDownloading) return
    setIsDownloading(true)
    try {
      await downloadMediaFile(imageUrl, 'generated-image.png')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='gap-4 sm:max-w-2xl'>
        <DialogHeader className='gap-3'>
          <DialogTitle>{t('Image Preview')}</DialogTitle>
          {taskId ? (
            <div className='bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2'>
              <DialogDescription className='min-w-0 flex-1 font-mono text-xs leading-snug break-all'>
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

        <div className='bg-muted/30 relative flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-xl border p-4'>
          {(isLoading || hasError) && (
            <Skeleton className='absolute inset-4 rounded-lg' />
          )}

          <img
            src={imageUrl}
            alt={t('Generated image')}
            className={`max-h-[min(52vh,520px)] max-w-full rounded-lg object-contain shadow-md ${
              isLoading || hasError ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading='lazy'
          />

          {hasError && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <p className='text-muted-foreground text-sm'>
                {t('Failed to load image')}
              </p>
            </div>
          )}
        </div>

        <p className='text-muted-foreground text-center text-xs'>
          {t('Generated images and videos are only kept for 3 days.')}
        </p>

        <MediaDialogFooter
          mediaUrl={imageUrl}
          disabled={isLoading || hasError}
          isDownloading={isDownloading}
          onDownload={() => void handleDownload()}
        />

        <RequestDataPanel data={requestData} />
      </DialogContent>
    </Dialog>
  )
}
