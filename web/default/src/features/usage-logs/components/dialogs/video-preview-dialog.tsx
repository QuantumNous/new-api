import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface VideoPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoUrl: string
  title?: string
}

export function VideoPreviewDialog({
  open,
  onOpenChange,
  videoUrl,
  title,
}: VideoPreviewDialogProps) {
  const { t } = useTranslation()
  const [error, setError] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{title || t('Video preview')}</DialogTitle>
        </DialogHeader>
        <div className='bg-muted/40 relative aspect-video w-full overflow-hidden rounded-md'>
          {error ? (
            <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm'>
              <span>{t('Failed to load video')}</span>
              <Button asChild variant='outline' size='sm'>
                <a href={videoUrl} target='_blank' rel='noopener noreferrer'>
                  <ExternalLink className='mr-1 h-3 w-3' />
                  {t('Open in new tab')}
                </a>
              </Button>
            </div>
          ) : (
            <video
              src={videoUrl}
              controls
              autoPlay
              className='h-full w-full object-contain'
              onError={() => setError(true)}
            />
          )}
        </div>
        <div className='flex justify-end'>
          <Button asChild variant='outline' size='sm'>
            <a href={videoUrl} target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='mr-1 h-3 w-3' />
              {t('Open in new tab')}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
