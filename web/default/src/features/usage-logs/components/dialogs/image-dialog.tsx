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
import { Copy, Check, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'
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
import {
  usageLogsContentDialogDescClassName,
  usageLogsContentDialogImageErrorClassName,
  usageLogsContentDialogImageFrameClassName,
  usageLogsContentDialogOutlineButtonClassName,
  usageLogsContentDialogSurfaceWideClassName,
  usageLogsContentDialogTitleClassName,
  usageLogsContentDialogUrlPanelClassName,
  usageLogsContentDialogUrlTextClassName,
} from '../../lib/ops-ui-styles'

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
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

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
      <DialogContent className={usageLogsContentDialogSurfaceWideClassName}>
        <DialogHeader>
          <DialogTitle className={usageLogsContentDialogTitleClassName}>
            {t('usageLogs.dialog.image.title')}
          </DialogTitle>
          <DialogDescription className={usageLogsContentDialogDescClassName}>
            {taskId
              ? `${t('usageLogs.dialog.image.task_id_label')}: ${taskId}`
              : t('usageLogs.dialog.image.description')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-wrap items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            className={usageLogsContentDialogOutlineButtonClassName}
            render={
              <a
                href={imageUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1.5'
              />
            }
          >
            <ExternalLink className='size-3.5' />
            {t('usageLogs.dialog.image.open_original')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            className={usageLogsContentDialogOutlineButtonClassName}
            onClick={() => copyToClipboard(imageUrl)}
          >
            {copiedText === imageUrl ? (
              <Check className='size-3.5 text-emerald-400' />
            ) : (
              <Copy className='size-3.5' />
            )}
            {t('usageLogs.dialog.image.copy_url')}
          </Button>
        </div>

        <ScrollArea className='max-h-[600px]'>
          <div className='py-4'>
            <div className={usageLogsContentDialogImageFrameClassName}>
              {(isLoading || hasError) && (
                <Skeleton className='absolute inset-0 h-full w-full rounded-lg bg-slate-200/60' />
              )}

              <img
                src={imageUrl}
                alt={t('usageLogs.dialog.image.alt')}
                className={cn(
                  'max-h-[550px] w-full rounded-lg object-contain',
                  isLoading || hasError ? 'opacity-0' : 'opacity-100'
                )}
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading='lazy'
              />

              {hasError && (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <p className={usageLogsContentDialogImageErrorClassName}>
                    {t('usageLogs.dialog.image.load_failed')}
                  </p>
                </div>
              )}
            </div>

            <div className={usageLogsContentDialogUrlPanelClassName}>
              <p className={usageLogsContentDialogUrlTextClassName}>{imageUrl}</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
