/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Bot, Globe, Image, Paperclip, Trash2Icon, Video } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInputButton,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/stores/playground-store'

import { getInputControlState, getSubmittableInputText } from '../../lib'
import { DOCUMENT_ACCEPT } from '../../lib/attachments/document-extract'
import type { ChatAttachment } from '../../types'
import { ChatAttachmentStrip } from './attachments/chat-attachments'
import { useChatAttachments } from './attachments/use-chat-attachments'
import { ComposerShell } from './composer'
import { useComposerText } from './use-composer'

type ChatComposerProps = {
  onSubmit: (text: string, attachments?: ChatAttachment[]) => boolean
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  isModelLoading?: boolean
  hasMessages?: boolean
  onClearMessages?: () => void
}

/**
 * Chat composer: shared composer skeleton plus image/PDF/document attachments
 * (file dialog, paste, drag-drop) and the high-frequency web-search
 * shortcut. Model and group selection live in the catalog and settings
 * panel; sampling parameters live in the settings panel.
 */
export function ChatComposer(props: ChatComposerProps) {
  const { t } = useTranslation()
  const { text, setText } = useComposerText()
  const attachments = useChatAttachments()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const models = usePlaygroundStore((state) => state.models)
  const groups = usePlaygroundStore((state) => state.groups)
  const toolMode = usePlaygroundStore((state) => state.chatTools.mode)
  const setChatTools = usePlaygroundStore((state) => state.setChatTools)

  const { canSubmit, shouldShowStop } = getInputControlState({
    disabled: props.disabled,
    groups,
    hasAttachments: attachments.attachments.length > 0,
    hasStopHandler: Boolean(props.onStop),
    // Documents must finish server-side parsing before the turn can be sent,
    // otherwise their text would be silently missing from the request.
    isAddingAttachments: attachments.isAdding || attachments.isParsing,
    isGenerating: props.isGenerating,
    isModelLoading: props.isModelLoading,
    models,
    text,
  })

  const handleSubmit = (message: PromptInputMessage) => {
    if (attachments.isAdding || attachments.isParsing) return
    const submittableText = getSubmittableInputText(message, props.disabled)
    if (!submittableText && attachments.attachments.length === 0) return
    if (props.onSubmit(submittableText ?? '', attachments.attachments)) {
      setText('')
      attachments.clear()
    }
  }

  const handleClearMessages = () => {
    props.onClearMessages?.()
    setClearConfirmOpen(false)
    toast.success(t('Started a new chat'))
  }

  return (
    <>
      <ComposerShell
        text={text}
        onTextChange={setText}
        onSubmit={handleSubmit}
        placeholder={t('Ask anything')}
        disabled={props.disabled}
        canSubmit={canSubmit}
        showStop={shouldShowStop}
        onStop={props.onStop}
        onPaste={attachments.handlePaste}
        onDrop={attachments.handleDrop}
        onDragOver={attachments.handleDragOver}
        attachments={
          <ChatAttachmentStrip
            attachments={attachments.attachments}
            onRemove={attachments.removeAt}
            onRetry={attachments.retryAt}
          />
        }
        tools={
          <>
            <input
              ref={fileInputRef}
              type='file'
              accept={`image/*,${DOCUMENT_ACCEPT}`}
              multiple
              disabled={props.disabled || attachments.isAdding}
              className='hidden'
              onChange={(event) => {
                void attachments.addFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <PromptInputButton
                    aria-label={t('Attach images or documents')}
                    className='text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium'
                    disabled={
                      props.disabled ||
                      attachments.isAdding ||
                      attachments.isFull
                    }
                    onClick={() => fileInputRef.current?.click()}
                    variant='ghost'
                  >
                    <Paperclip size={16} />
                  </PromptInputButton>
                }
              />
              <TooltipContent>
                <p>{t('Attach images or documents')}</p>
              </TooltipContent>
            </Tooltip>

            <div className='no-scrollbar flex max-w-[min(100%,14rem)] items-center gap-0.5 overflow-x-auto sm:max-w-none sm:gap-1'>
              {(
                [
                  ['auto', t('Auto'), Bot],
                  ['image', t('Image'), Image],
                  ['video', t('Video'), Video],
                  ['search', t('Search'), Globe],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type='button'
                  aria-pressed={toolMode === mode}
                  aria-label={label}
                  onClick={() =>
                    setChatTools({ mode, webSearch: mode === 'search' })
                  }
                  className={cn(
                    'inline-flex h-8 shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-transparent px-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    toolMode === mode
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <Icon className='size-3.5' aria-hidden='true' />
                  <span className='hidden sm:inline'>{label}</span>
                </button>
              ))}
            </div>

            <Tooltip>
              <TooltipTrigger
                render={
                  <PromptInputButton
                    aria-label={t('New chat')}
                    className='text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-medium'
                    disabled={
                      props.disabled ||
                      !props.hasMessages ||
                      !props.onClearMessages
                    }
                    onClick={() => setClearConfirmOpen(true)}
                    variant='ghost'
                  >
                    <Trash2Icon size={16} />
                  </PromptInputButton>
                }
              />
              <TooltipContent>
                <p>{t('New chat')}</p>
              </TooltipContent>
            </Tooltip>
          </>
        }
      />

      <ConfirmDialog
        destructive
        desc={t(
          'Starts a new chat. Your previous conversation stays in History and is not deleted.'
        )}
        confirmText={t('New chat')}
        handleConfirm={handleClearMessages}
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t('Start a new chat?')}
      />
    </>
  )
}
