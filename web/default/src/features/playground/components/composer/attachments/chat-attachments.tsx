/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { FileText, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { attachmentPreviewSrc } from '../../../lib/attachments/attachment-utils'
import type { ChatAttachment } from '../../../types'

export function ChatAttachmentStrip(props: {
  attachments: ChatAttachment[]
  onRemove: (index: number) => void
  /** When false, PDFs are downgraded to extracted text before sending. */
  nativeFileInput?: boolean
}) {
  const { t } = useTranslation()
  if (props.attachments.length === 0) return null

  const downgradedPdfs = props.attachments.filter(
    (attachment) =>
      attachment.kind === 'file' &&
      props.nativeFileInput === false &&
      (attachment.text?.trim() ?? '') !== ''
  )

  return (
    <div className='no-scrollbar flex flex-col gap-1 px-3 pb-2 sm:px-5'>
      {downgradedPdfs.length > 0 && (
        <p className='text-muted-foreground text-[11px]'>
          {t(
            'This model cannot read PDF files directly, so their extracted text will be sent instead.'
          )}
        </p>
      )}
      <div className='no-scrollbar flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible'>
        {props.attachments.map((attachment, index) => (
          <div key={attachment.id} className='relative shrink-0'>
            {attachmentPreviewSrc(attachment) ? (
              <img
                src={attachmentPreviewSrc(attachment)}
                alt={t('Attachment {{index}}', { index: index + 1 })}
                className='border-border size-16 rounded-xl border object-cover sm:size-14 sm:rounded-lg'
              />
            ) : (
              <div className='border-border bg-muted flex h-16 max-w-[11rem] items-center gap-2 rounded-xl border px-3 sm:h-14 sm:max-w-40 sm:rounded-lg'>
                <FileText className='text-muted-foreground size-5 shrink-0' />
                <span className='truncate text-xs' title={attachment.name}>
                  {attachment.name}
                </span>
              </div>
            )}
            <button
              type='button'
              aria-label={t('Remove attachment')}
              onClick={() => props.onRemove(index)}
              className='bg-background border-border absolute -top-1.5 -right-1.5 flex size-6 touch-manipulation items-center justify-center rounded-full border shadow-sm sm:size-auto sm:p-0.5'
            >
              <X className='size-3.5 sm:size-3' />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
