/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { FileText, Loader2, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { attachmentPreviewSrc } from '../../../lib/attachments/attachment-utils'
import type { ChatAttachment, ChatDocumentAttachment } from '../../../types'

function documentStatusLine(
  attachment: ChatDocumentAttachment,
  t: (key: string, options?: Record<string, unknown>) => string
): string | null {
  if (attachment.status === 'processing') return t('Reading document…')
  if (attachment.status === 'ocr') {
    if (attachment.ocrTotal) {
      return t('Recognizing pages {{done}}/{{total}}…', {
        done: attachment.ocrDone ?? 0,
        total: attachment.ocrTotal,
      })
    }
    return t('Recognizing pages…')
  }
  return null
}

export function ChatAttachmentStrip(props: {
  attachments: ChatAttachment[]
  onRemove: (index: number) => void
  onRetry?: (index: number) => void
}) {
  const { t } = useTranslation()
  if (props.attachments.length === 0) return null

  const failed = props.attachments.find(
    (attachment) =>
      attachment.kind === 'document' && attachment.status === 'failed'
  ) as ChatDocumentAttachment | undefined

  return (
    <div className='no-scrollbar flex flex-col gap-1 px-3 pb-2 sm:px-5'>
      {failed && (
        <p className='text-destructive text-[11px]'>
          {failed.error || t('Could not read this document.')}{' '}
          {t('It will not be sent.')}
        </p>
      )}
      <div className='no-scrollbar flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible'>
        {props.attachments.map((attachment, index) => {
          const isDocument = attachment.kind === 'document'
          const busy =
            isDocument &&
            (attachment.status === 'processing' || attachment.status === 'ocr')
          const isFailed = isDocument && attachment.status === 'failed'
          const statusLine = isDocument
            ? documentStatusLine(attachment, t)
            : null
          return (
            <div key={attachment.id} className='relative shrink-0'>
              {attachmentPreviewSrc(attachment) ? (
                <img
                  src={attachmentPreviewSrc(attachment)}
                  alt={t('Attachment {{index}}', { index: index + 1 })}
                  className='border-border size-16 rounded-xl border object-cover sm:size-14 sm:rounded-lg'
                />
              ) : (
                <div
                  className={`bg-muted flex h-16 max-w-[13rem] items-center gap-2 rounded-xl border px-3 sm:h-14 sm:max-w-48 sm:rounded-lg ${
                    isFailed ? 'border-destructive/60' : 'border-border'
                  }`}
                >
                  {busy ? (
                    <Loader2
                      className='text-muted-foreground size-5 shrink-0 animate-spin'
                      aria-hidden='true'
                    />
                  ) : (
                    <FileText
                      className={`size-5 shrink-0 ${
                        isFailed ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                      aria-hidden='true'
                    />
                  )}
                  <span className='flex min-w-0 flex-col'>
                    <span className='truncate text-xs' title={attachment.name}>
                      {attachment.name}
                    </span>
                    {statusLine && (
                      <span className='text-muted-foreground truncate text-[10px]'>
                        {statusLine}
                      </span>
                    )}
                    {isFailed && props.onRetry && (
                      <button
                        type='button'
                        onClick={() => props.onRetry?.(index)}
                        className='text-destructive inline-flex items-center gap-1 text-[10px] underline-offset-2 hover:underline'
                      >
                        <RotateCcw className='size-3' aria-hidden='true' />
                        {t('Retry')}
                      </button>
                    )}
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
          )
        })}
      </div>
    </div>
  )
}
