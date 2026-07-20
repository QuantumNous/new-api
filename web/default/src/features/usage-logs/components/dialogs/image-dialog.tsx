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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

import { getSafeImageUrl } from '../../lib/image-task-info'

interface ImageDialogProps {
  imageUrl: string
  images?: readonly ImageDialogItem[]
  taskId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export interface ImageDialogItem {
  url: string
  revisedPrompt?: string
}

export function ImageDialog({
  imageUrl,
  images,
  taskId,
  open,
  onOpenChange,
}: ImageDialogProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState(imageUrl)
  const gallery = useMemo(() => {
    const items = images?.length ? images : [{ url: imageUrl }]
    const deduplicated = new Map<string, ImageDialogItem>()
    for (const item of items) {
      const safeUrl = getSafeImageUrl(item.url)
      if (safeUrl) deduplicated.set(safeUrl, { ...item, url: safeUrl })
    }
    const safeImageUrl = getSafeImageUrl(imageUrl)
    if (safeImageUrl && !deduplicated.has(safeImageUrl)) {
      deduplicated.set(safeImageUrl, { url: safeImageUrl })
    }
    return [...deduplicated.values()]
  }, [imageUrl, images])
  const selectedImage =
    gallery.find((image) => image.url === selectedUrl) ?? gallery[0]
  const showError = hasError || !selectedImage
  const firstGalleryUrl = gallery[0]?.url ?? ''
  const galleryKey = gallery.map((image) => image.url).join('\u0000')

  useEffect(() => {
    setSelectedUrl(firstGalleryUrl)
    setIsLoading(true)
    setHasError(false)
  }, [open, firstGalleryUrl, galleryKey])

  // Reset loading state when dialog opens or image URL changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIsLoading(true)
      setHasError(false)
      setSelectedUrl(firstGalleryUrl)
    }
    onOpenChange(newOpen)
  }

  const selectImage = (url: string) => {
    setSelectedUrl(url)
    setIsLoading(true)
    setHasError(false)
  }

  const handleImageLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('Image Preview')}
      description={
        taskId ? `${t('Task ID:')} ${taskId}` : t('View the generated image')
      }
      contentClassName='sm:max-w-3xl'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      <ScrollArea className='max-h-[600px]'>
        <div className='py-4'>
          <div className='bg-muted/50 relative flex min-h-[300px] items-center justify-center rounded-lg border'>
            {/* Skeleton - show when loading or error */}
            {(isLoading || showError) && (
              <Skeleton className='absolute inset-0 h-full w-full rounded-lg' />
            )}

            {/* Actual Image */}
            {selectedImage && (
              <img
                key={selectedImage.url}
                src={selectedImage.url}
                alt={selectedImage.revisedPrompt || t('Generated image')}
                className={`max-h-[550px] w-full rounded-lg object-contain ${
                  isLoading || hasError ? 'opacity-0' : 'opacity-100'
                }`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading='lazy'
                decoding='async'
                referrerPolicy='no-referrer'
              />
            )}

            {/* Error text overlay (shown on skeleton) */}
            {showError && (
              <div className='absolute inset-0 flex items-center justify-center'>
                <p className='text-muted-foreground text-sm'>
                  {t('Failed to load image')}
                </p>
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className='mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6'>
              {gallery.map((image, index) => (
                <button
                  key={image.url}
                  type='button'
                  className={`focus-visible:ring-ring aspect-square overflow-hidden rounded-md border transition-opacity focus-visible:ring-2 focus-visible:outline-none ${
                    image.url === selectedImage?.url
                      ? 'border-primary opacity-100'
                      : 'border-border opacity-65 hover:opacity-100'
                  }`}
                  onClick={() => selectImage(image.url)}
                  aria-label={`${t('View')} ${t('Image')} ${index + 1} / ${gallery.length}`}
                  aria-pressed={image.url === selectedImage?.url}
                >
                  <img
                    src={image.url}
                    alt={image.revisedPrompt || t('Generated image')}
                    className='h-full w-full object-cover'
                    loading='lazy'
                    decoding='async'
                    referrerPolicy='no-referrer'
                  />
                </button>
              ))}
            </div>
          )}

          {/* Image URL */}
          {selectedImage && (
            <div className='bg-muted mt-4 rounded-md p-3'>
              <a
                href={selectedImage.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground block font-mono text-xs break-all hover:underline'
              >
                {selectedImage.url}
              </a>
            </div>
          )}
        </div>
      </ScrollArea>
    </Dialog>
  )
}
