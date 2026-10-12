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
import { FileTextIcon, ImageIcon, PaperclipIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  PromptInputHoverCard,
  PromptInputHoverCardContent,
  PromptInputHoverCardTrigger,
} from '@/components/ai-elements/prompt-input'

import { ATTACHMENT_ACCEPT } from '../../lib/attachment/attachment-constants'
import type { PlaygroundAttachment } from '../../types'
import { AttachmentPreviewDialog } from '../attachment/attachment-preview'

/**
 * Chip leading icon. Image attachments with a data URL get a thumbnail;
 * formats without a browser decoder (HEIC, for one) hide the broken image and
 * leave the icon, while the data URL is still sent to the model either way.
 */
function renderChipIcon(attachment: PlaygroundAttachment, isImage: boolean) {
  if (isImage && attachment.dataUrl) {
    return (
      <img
        alt=''
        className='size-5 shrink-0 rounded object-cover'
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
        src={attachment.dataUrl}
      />
    )
  }

  const Icon = isImage ? ImageIcon : FileTextIcon

  return <Icon className='size-3.5 shrink-0 opacity-70' />
}

/**
 * Hidden picker plus the button that opens it.
 *
 * `accept` mirrors the extensions the parsers actually support, so unsupported
 * files are filtered before they reach the parsing code.
 */
export function PlaygroundAttachButton({
  disabled,
  inputRef,
  isParsing,
  onFiles,
  onOpen,
}: {
  disabled?: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  isParsing: boolean
  onFiles: (files: File[]) => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <input
        accept={ATTACHMENT_ACCEPT}
        className='hidden'
        multiple
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          // Reset so picking the same file twice still fires `change`.
          event.target.value = ''
          onFiles(files)
        }}
        ref={inputRef}
        type='file'
      />

      <Button
        aria-label={t('Attach files')}
        className='text-muted-foreground hover:text-foreground size-7 shrink-0 rounded-md'
        disabled={disabled || isParsing}
        onClick={onOpen}
        size='icon'
        title={t('Attach files')}
        type='button'
        variant='ghost'
      >
        <PaperclipIcon className={isParsing ? 'size-4 animate-pulse' : 'size-4'} />
      </Button>
    </>
  )
}

/**
 * Attachment chips with hover preview and click-to-open full preview.
 *
 * Documents preview their extracted text and images their thumbnail, so the
 * user can confirm what the model will actually receive. Clicking a chip opens
 * the full-size preview; the file name area is the trigger so the remove button
 * stays independently clickable.
 */
export function PlaygroundAttachmentList({
  attachments,
  onRemove,
}: {
  attachments: PlaygroundAttachment[]
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()

  if (attachments.length === 0) return null

  return (
    <div className='border-border/60 flex flex-wrap gap-1.5 border-b px-3 py-2'>
      {attachments.map((attachment) => {
        const isImage = attachment.kind === 'image'

        return (
          <PromptInputHoverCard key={attachment.id}>
            <PromptInputHoverCardTrigger
              render={
                <div className='group border-border hover:bg-accent dark:hover:bg-accent/50 relative flex h-8 cursor-default items-center gap-1.5 rounded-md border px-1.5 text-sm font-medium transition-all select-none' />
              }
            >
              <AttachmentPreviewDialog attachment={attachment}>
                <span
                  className='flex cursor-pointer items-center gap-1.5'
                  title={t('Click to preview')}
                >
                  {renderChipIcon(attachment, isImage)}

                  <span className='max-w-40 truncate'>
                    {attachment.filename}
                  </span>

                  {attachment.textTruncated && (
                    <span className='text-muted-foreground text-xs'>
                      {t('truncated')}
                    </span>
                  )}
                </span>
              </AttachmentPreviewDialog>

              <button
                aria-label={t('Remove attachment')}
                className='hover:bg-accent-foreground/10 ml-0.5 rounded p-0.5'
                onClick={() => onRemove(attachment.id)}
                type='button'
              >
                <XIcon className='size-3' />
              </button>
            </PromptInputHoverCardTrigger>

            <PromptInputHoverCardContent className='max-h-64 w-80 overflow-auto'>
              <p className='mb-1.5 font-medium'>{attachment.filename}</p>
              <p className='text-muted-foreground text-xs'>
                {isImage
                  ? t('Sent to the model as an image.')
                  : t('Extracted text sent as context:')}
              </p>
              {!isImage && attachment.text && (
                <pre className='mt-2 max-h-40 overflow-auto text-xs whitespace-pre-wrap'>
                  {attachment.text.slice(0, 1200)}
                </pre>
              )}
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('Click to preview')}
              </p>
            </PromptInputHoverCardContent>
          </PromptInputHoverCard>
        )
      })}
    </div>
  )
}
