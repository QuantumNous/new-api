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
import { CopyIcon, DownloadIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { copyImageAttachment, downloadImageAttachment } from '../../lib'
import type { MessageAttachment } from '../../types'

type PlaygroundMessageAttachmentsProps = {
  attachments: MessageAttachment[]
}

export function PlaygroundMessageAttachments(
  props: PlaygroundMessageAttachmentsProps
) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<MessageAttachment | null>(null)

  if (props.attachments.length === 0) {
    return null
  }

  const handleDownload = async (
    attachment: MessageAttachment,
    index: number
  ) => {
    try {
      await downloadImageAttachment(attachment, index)
    } catch {
      toast.error(t('Could not download the image'))
    }
  }

  const handleCopy = async (attachment: MessageAttachment) => {
    try {
      const result = await copyImageAttachment(attachment)
      toast.success(
        result === 'image' ? t('Image copied') : t('Image link copied')
      )
    } catch {
      toast.error(t('Could not copy the image'))
    }
  }

  return (
    <>
      <div className='mb-2 flex flex-wrap gap-2'>
        {props.attachments.map((attachment, index) => (
          <div
            className='border-border/70 group relative overflow-hidden rounded-lg border'
            key={attachment.url}
          >
            <button
              className='block cursor-zoom-in'
              onClick={() => setPreview(attachment)}
              type='button'
            >
              <img
                alt={attachment.filename || t('Attachment')}
                className='max-h-64 max-w-full object-contain'
                src={attachment.url}
              />
              <span className='sr-only'>{t('Preview image')}</span>
            </button>
            <div className='absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
              <Button
                aria-label={t('Copy image')}
                className='bg-background/80 size-7 backdrop-blur'
                onClick={() => void handleCopy(attachment)}
                size='icon-sm'
                type='button'
                variant='outline'
              >
                <CopyIcon className='size-3.5' />
              </Button>
              <Button
                aria-label={t('Download image')}
                className='bg-background/80 size-7 backdrop-blur'
                onClick={() => void handleDownload(attachment, index)}
                size='icon-sm'
                type='button'
                variant='outline'
              >
                <DownloadIcon className='size-3.5' />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle className='truncate'>
              {preview?.filename || t('Attachment')}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <img
              alt={preview.filename || t('Attachment')}
              className='max-h-[70vh] w-full object-contain'
              src={preview.url}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
