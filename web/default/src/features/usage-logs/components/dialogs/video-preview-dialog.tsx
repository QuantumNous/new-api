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
import { Copy, ExternalLink, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'

interface VideoPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoUrl: string
}

export function VideoPreviewDialog(props: VideoPreviewDialogProps) {
  const { t } = useTranslation()
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (props.open) {
      setHasError(false)
      setIsLoading(true)
    }
  }, [props.open, props.videoUrl])

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        <>
          <Video className='h-5 w-5' />
          {t('Video Preview')}
        </>
      }
      contentClassName='sm:max-w-3xl'
      titleClassName='flex items-center gap-2'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      {!props.videoUrl ? (
        <p className='text-muted-foreground py-4 text-center text-sm'>
          {t('None')}
        </p>
      ) : hasError ? (
        <div className='space-y-4 py-2 text-center'>
          <p className='text-muted-foreground text-sm'>
            {t('Video playback failed')}
          </p>
          <div className='flex flex-wrap justify-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='gap-1'
              onClick={() => window.open(props.videoUrl, '_blank')}
            >
              <ExternalLink className='h-3.5 w-3.5' />
              {t('Open in new tab')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='gap-1'
              onClick={() => {
                navigator.clipboard.writeText(props.videoUrl)
                toast.success(t('Copied'))
              }}
            >
              <Copy className='h-3.5 w-3.5' />
              {t('Copy Link')}
            </Button>
          </div>
          <p className='text-muted-foreground px-2 text-[11px] break-all'>
            {props.videoUrl}
          </p>
        </div>
      ) : (
        <div className='relative'>
          {isLoading && (
            <div className='text-muted-foreground absolute inset-0 flex items-center justify-center text-sm'>
              {t('Loading...')}
            </div>
          )}
          <video
            src={props.videoUrl}
            controls
            preload='metadata'
            className='bg-muted/20 max-h-[70vh] w-full rounded-md'
            onError={() => {
              setHasError(true)
              setIsLoading(false)
            }}
            onLoadedData={() => setIsLoading(false)}
          />
        </div>
      )}
    </Dialog>
  )
}
