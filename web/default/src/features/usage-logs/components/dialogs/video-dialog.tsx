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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface VideoDialogProps {
  videoUrl: string
  taskId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VideoDialog({
  videoUrl,
  taskId,
  open,
  onOpenChange,
}: VideoDialogProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIsLoading(true)
      setHasError(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Video Preview')}</DialogTitle>
          <DialogDescription>
            {taskId
              ? `${t('Task ID:')} ${taskId}`
              : t('View the generated video')}
          </DialogDescription>
        </DialogHeader>

        <p className='text-muted-foreground text-xs'>
          {t('Generated images and videos are only kept for 3 days.')}
        </p>

        <ScrollArea className='max-h-[600px]'>
          <div className='py-4'>
            <div className='bg-muted/50 relative flex min-h-[300px] items-center justify-center rounded-lg border'>
              {(isLoading || hasError) && (
                <Skeleton className='absolute inset-0 h-full w-full rounded-lg' />
              )}

              <video
                src={videoUrl}
                controls
                className={`max-h-[550px] w-full rounded-lg ${
                  isLoading || hasError ? 'opacity-0' : 'opacity-100'
                }`}
                onLoadedData={() => {
                  setIsLoading(false)
                  setHasError(false)
                }}
                onError={() => {
                  setIsLoading(false)
                  setHasError(true)
                }}
              />

              {hasError && (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <p className='text-muted-foreground text-sm'>
                    {t('Failed to load video')}
                  </p>
                </div>
              )}
            </div>

            <div className='bg-muted mt-4 rounded-md p-3'>
              <p className='text-muted-foreground font-mono text-xs break-all'>
                {videoUrl}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
