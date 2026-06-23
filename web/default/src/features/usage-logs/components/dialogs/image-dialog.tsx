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
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadMediaFile } from '../../lib/download-media'

interface ImageDialogProps {
  imageUrl: string
  taskId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImageDialog({
  imageUrl,
  taskId,
  open,
  onOpenChange,
}: ImageDialogProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Reset loading state when dialog opens or image URL changes
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
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Image Preview')}</DialogTitle>
          <DialogDescription>
            {taskId
              ? `${t('Task ID:')} ${taskId}`
              : t('View the generated image')}
          </DialogDescription>
        </DialogHeader>

        <p className='text-muted-foreground text-xs'>
          {t('Generated images and videos are only kept for 3 days.')}
        </p>

        <ScrollArea className='max-h-[600px]'>
          <div className='py-4'>
            <div className='bg-muted/50 relative flex min-h-[300px] items-center justify-center rounded-lg border'>
              {/* Skeleton - show when loading or error */}
              {(isLoading || hasError) && (
                <Skeleton className='absolute inset-0 h-full w-full rounded-lg' />
              )}

              {/* Actual Image */}
              <img
                src={imageUrl}
                alt={t('Generated image')}
                className={`max-h-[550px] w-full rounded-lg object-contain ${
                  isLoading || hasError ? 'opacity-0' : 'opacity-100'
                }`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading='lazy'
              />

              {/* Error text overlay (shown on skeleton) */}
              {hasError && (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <p className='text-muted-foreground text-sm'>
                    {t('Failed to load image')}
                  </p>
                </div>
              )}
            </div>

            {/* Image URL */}
            <div className='bg-muted mt-4 flex items-start gap-3 rounded-md p-3'>
              <p className='text-muted-foreground min-w-0 flex-1 font-mono text-xs break-all'>
                {imageUrl}
              </p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='shrink-0'
                disabled={isLoading || hasError || isDownloading}
                onClick={() => void handleDownload()}
              >
                <Download className='size-4' />
                {t('Download')}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
