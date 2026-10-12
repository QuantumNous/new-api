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
import type { TFunction } from 'i18next'
import { DownloadIcon, FileTextIcon, ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import type { PlaygroundAttachment } from '../../types'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Human-readable note describing what the model actually receives. */
function describeDelivery(attachment: PlaygroundAttachment, t: TFunction) {
  if (attachment.kind === 'image') return t('Sent to the model as an image.')

  return t('Extracted text sent as context:')
}

/**
 * Click-to-preview dialog for a single attachment.
 *
 * Images render at full size (with a download fallback for formats the browser
 * cannot decode, such as HEIC), documents show their extracted text in full.
 * The data URL or extracted text is already in memory, so nothing is re-fetched
 * and no extra request hits the server.
 */
export function AttachmentPreviewDialog({
  attachment,
  children,
}: {
  attachment: PlaygroundAttachment
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const isImage = attachment.kind === 'image'
  const [imageBroken, setImageBroken] = useState(false)
  const hasText = Boolean(attachment.text?.trim())

  const handleOpenChange = (open: boolean) => {
    // Reset the decode-failure flag so reopening retries the image instead of
    // showing the fallback for the rest of the session.
    if (open) setImageBroken(false)
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    let objectUrl: string | null = null

    if (attachment.dataUrl) {
      link.href = attachment.dataUrl
      link.download = attachment.filename
    } else if (attachment.text) {
      // Documents are stored as extracted text only (no dataUrl), so the best
      // we can offer is the text the model actually received, as a .txt file.
      const blob = new Blob([attachment.text], { type: 'text/plain;charset=utf-8' })
      objectUrl = URL.createObjectURL(blob)
      link.href = objectUrl
      link.download = `${attachment.filename}.txt`
    } else {
      return
    }

    // Safari and Firefox ignore clicks on detached anchors, so the element has
    // to be in the document while the click is dispatched.
    document.body.appendChild(link)
    link.click()
    link.remove()

    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger render={<button type='button' />}>{children}</DialogTrigger>

      <DialogContent className='flex max-h-[85vh] w-[min(92vw,58rem)] flex-col gap-3 sm:max-w-[min(92vw,58rem)]'>
        <DialogHeader>
          <DialogTitle className='truncate pr-8'>
            {attachment.filename}
          </DialogTitle>
          <DialogDescription>
            {attachment.mediaType || (isImage ? 'image' : 'file')} ·{' '}
            {formatSize(attachment.size)} · {describeDelivery(attachment, t)}
            {attachment.textTruncated ? ` · ${t('truncated')}` : ''}
          </DialogDescription>
        </DialogHeader>

        {isImage && attachment.dataUrl && !imageBroken && (
          <div className='bg-muted/40 flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border p-2'>
            <img
              alt={attachment.filename}
              className='max-h-[62vh] w-auto max-w-full rounded object-contain'
              onError={() => setImageBroken(true)}
              src={attachment.dataUrl}
            />
          </div>
        )}

        {isImage && (imageBroken || !attachment.dataUrl) && (
          <div className='bg-muted/40 text-muted-foreground flex flex-col items-center gap-2 rounded-lg border p-10 text-sm'>
            <ImageIcon className='size-8 opacity-60' />
            <p>{t('This image format cannot be previewed in the browser.')}</p>
            <p className='text-xs'>
              {t('It is still sent to the model as an image.')}
            </p>
          </div>
        )}

        {!isImage && (
          <div className='bg-muted/40 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border p-3'>
            {hasText ? (
              <pre className='max-h-[58vh] overflow-auto text-xs leading-relaxed whitespace-pre-wrap'>
                {attachment.text}
              </pre>
            ) : (
              <div className='text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm'>
                <FileTextIcon className='size-8 opacity-60' />
                <p>{t('No text could be extracted from this file.')}</p>
              </div>
            )}
          </div>
        )}

        {(attachment.dataUrl || attachment.text) && (
          <div className='flex justify-end'>
            <Button onClick={handleDownload} size='sm' variant='outline'>
              <DownloadIcon className='mr-1.5 size-3.5' />
              {t('Download')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Read-only attachment chips for a sent message.
 *
 * Mirrors the composer chips so a user can still see (and open) what was
 * attached to an earlier message instead of the files vanishing on send.
 */
export function MessageAttachmentList({
  attachments,
}: {
  attachments: PlaygroundAttachment[]
}) {
  const { t } = useTranslation()

  if (attachments.length === 0) return null

  return (
    <div className='mb-1.5 flex flex-wrap gap-1.5'>
      {attachments.map((attachment) => {
        const isImage = attachment.kind === 'image'

        return (
          <AttachmentPreviewDialog
            attachment={attachment}
            key={attachment.id}
          >
            <div
              className='group border-border/70 bg-muted/40 hover:bg-accent dark:hover:bg-accent/50 flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs font-medium transition-colors'
              title={t('Click to preview')}
            >
              {isImage && attachment.dataUrl ? (
                <img
                  alt=''
                  className='size-6 shrink-0 rounded object-cover'
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                  src={attachment.dataUrl}
                />
              ) : (
                <FileTextIcon className='size-3.5 shrink-0 opacity-70' />
              )}
              <span className='max-w-48 truncate'>{attachment.filename}</span>
            </div>
          </AttachmentPreviewDialog>
        )
      })}
    </div>
  )
}
