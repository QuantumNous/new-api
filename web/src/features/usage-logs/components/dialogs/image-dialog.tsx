import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

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
            <div className='bg-muted mt-4 rounded-md p-3'>
              <p className='text-muted-foreground font-mono text-xs break-all'>
                {imageUrl}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
