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
'use client'

import type { FileUIPart } from 'ai'
import { ImageIcon, PaperclipIcon, XIcon } from 'lucide-react'
import {
  type ComponentProps,
  Fragment,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { usePromptInputAttachments } from './prompt-input-context'
import {
  PromptInputHoverCard,
  PromptInputHoverCardContent,
  PromptInputHoverCardTrigger,
} from './prompt-input-hover-card'

export type PromptInputAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart & { id: string }
  className?: string
}

export function PromptInputAttachment({
  data,
  className,
  ...props
}: PromptInputAttachmentProps) {
  const { t } = useTranslation()
  const attachments = usePromptInputAttachments()

  const filename = data.filename || ''

  const mediaType =
    data.mediaType?.startsWith('image/') && data.url ? 'image' : 'file'
  const isImage = mediaType === 'image'

  const attachmentLabel = filename || (isImage ? 'Image' : 'Attachment')

  return (
    <PromptInputHoverCard>
      <PromptInputHoverCardTrigger
        render={
          <div
            className={cn(
              'group border-border hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 relative flex h-8 cursor-default items-center gap-1.5 rounded-md border px-1.5 text-sm font-medium transition-ui select-none',
              className
            )}
            key={data.id}
            {...props}
          />
        }
      >
        <div className='relative size-5 shrink-0'>
          <div className='bg-background absolute inset-0 flex size-5 items-center justify-center overflow-hidden rounded transition-opacity group-hover:opacity-0'>
            {isImage ? (
              <img
                alt={filename || 'attachment'}
                className='size-5 object-cover'
                height={20}
                src={data.url}
                width={20}
              />
            ) : (
              <div className='text-muted-foreground flex size-5 items-center justify-center'>
                <PaperclipIcon className='size-3' />
              </div>
            )}
          </div>
          <Button
            aria-label={t('Remove attachment')}
            className='absolute inset-0 size-5 cursor-pointer rounded p-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [&>svg]:size-2.5'
            onClick={(e) => {
              e.stopPropagation()
              attachments.remove(data.id)
            }}
            type='button'
            variant='ghost'
          >
            <XIcon />
            <span className='sr-only'>{t('Remove')}</span>
          </Button>
        </div>

        <span className='flex-1 truncate'>{attachmentLabel}</span>
      </PromptInputHoverCardTrigger>
      <PromptInputHoverCardContent className='w-auto p-2'>
        <div className='w-auto space-y-3'>
          {isImage && (
            <div className='flex max-h-96 w-96 items-center justify-center overflow-hidden rounded-md border'>
              <img
                alt={filename || 'attachment preview'}
                className='max-h-full max-w-full object-contain'
                height={384}
                src={data.url}
                width={448}
              />
            </div>
          )}
          <div className='flex items-center gap-2.5'>
            <div className='min-w-0 flex-1 space-y-1 px-0.5'>
              <h4 className='truncate text-sm leading-none font-semibold'>
                {filename || (isImage ? 'Image' : 'Attachment')}
              </h4>
              {data.mediaType && (
                <p className='text-muted-foreground truncate font-mono text-xs'>
                  {data.mediaType}
                </p>
              )}
            </div>
          </div>
        </div>
      </PromptInputHoverCardContent>
    </PromptInputHoverCard>
  )
}

export type PromptInputAttachmentsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> & {
  children: (attachment: FileUIPart & { id: string }) => ReactNode
}

export function PromptInputAttachments({
  children,
}: PromptInputAttachmentsProps) {
  const attachments = usePromptInputAttachments()

  if (!attachments.files.length) {
    return null
  }

  return attachments.files.map((file) => (
    <Fragment key={file.id}>{children(file)}</Fragment>
  ))
}

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string
}

export const PromptInputActionAddAttachments = ({
  label,
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('Add photos or files')
  const attachments = usePromptInputAttachments()

  return (
    <DropdownMenuItem
      {...props}
      onSelect={(e) => {
        e.preventDefault()
        attachments.openFileDialog()
      }}
    >
      <ImageIcon className='mr-2 size-4' /> {resolvedLabel}
    </DropdownMenuItem>
  )
}
