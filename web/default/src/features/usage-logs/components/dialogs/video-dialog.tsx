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
import { Skeleton } from '@/components/ui/skeleton'
import { downloadMediaFile } from '../../lib/download-media'
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
      <DialogContent className='gap-4 sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Video Preview')}</DialogTitle>
          <DialogDescription>
            {taskId
              ? `${t('Task ID:')} ${taskId}`
              : t('View the generated video')}
          </DialogDescription>
        </DialogHeader>

        <RequestDataPanel data={requestData} />

        <div className='space-y-3'>
          <div className='bg-muted/40 mx-auto flex w-full max-w-[360px] items-center justify-center rounded-lg border p-3'>
            <div className='relative flex min-h-[180px] w-full items-center justify-center'>
              {(isLoading || hasError) && (
                <Skeleton className='absolute inset-0 rounded-md' />
              )}

              <video
                src={videoUrl}
                controls
                className={`max-h-[240px] max-w-full rounded-md shadow-sm ${
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
          </div>

          <p className='text-muted-foreground text-center text-xs'>
            {t('Generated images and videos are only kept for 3 days.')}
          </p>

          <div className='bg-muted flex items-start gap-3 rounded-md p-3'>
            <p className='text-muted-foreground min-w-0 flex-1 font-mono text-xs break-all'>
              {videoUrl}
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
      </DialogContent>
    </Dialog>
  )
}
