/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { SendIcon, SquareIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type ComposerShellProps = {
  text: string
  onTextChange: (value: string) => void
  onSubmit: (message: PromptInputMessage) => void
  placeholder: string
  disabled?: boolean
  canSubmit: boolean
  showStop?: boolean
  onStop?: () => void
  /** Attachment strip rendered between textarea and footer */
  attachments?: React.ReactNode
  /** Left footer toolbar (attach button, quick toggles, …) */
  tools?: React.ReactNode
  /** Right footer content before the send button (price hint, …) */
  trailing?: React.ReactNode
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>
  onDrop?: React.DragEventHandler<HTMLDivElement>
  onDragOver?: React.DragEventHandler<HTMLDivElement>
  onDragLeave?: React.DragEventHandler<HTMLDivElement>
  /** Highlights the surface while files hover over the composer. */
  dragActive?: boolean
  className?: string
}

/**
 * Shared composer skeleton for all playground modes: textarea, attachment
 * strip, and a footer with tool slots plus the send/stop button. Sits in
 * normal document flow — no floating dock.
 */
export function ComposerShell(props: ComposerShellProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn('grid shrink-0 gap-2 px-1', props.className)}
      onDrop={props.onDrop}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
    >
      <PromptInput
        className='relative'
        groupClassName={cn(
          'playground-composer-surface bg-background/95 dark:bg-background/85 border-border/70 ring-1 ring-foreground/5 rounded-2xl overflow-hidden',
          // The composer manages its own disabled look; keep the InputGroup
          // from dimming the whole surface (and the Stop button) with it.
          'has-[[data-slot=input-group-control]:disabled]:opacity-100 has-[[data-slot=input-group-control]:disabled]:bg-background/95 dark:has-[[data-slot=input-group-control]:disabled]:bg-background/85',
          'shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] dark:shadow-[0_18px_60px_-32px_rgba(0,0,0,0.55)] transition-[border-color,box-shadow,transform] duration-200',
          'focus-within:border-primary/45 focus-within:ring-primary/15 focus-within:shadow-[0_22px_60px_-32px_rgba(15,23,42,0.45)] dark:focus-within:shadow-[0_22px_70px_-34px_rgba(0,0,0,0.7)]',
          props.dragActive &&
            'border-primary/70 ring-primary/25 bg-primary/[0.04] border-dashed',
          props.disabled && 'opacity-90'
        )}
        onSubmit={props.onSubmit}
      >
        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='min-h-[2.75rem] px-3.5 pt-3 pb-2 text-base leading-6 sm:min-h-0 sm:px-4 md:text-base'
          disabled={props.disabled}
          onChange={(event) => props.onTextChange(event.target.value)}
          onPaste={props.onPaste}
          placeholder={props.placeholder}
          value={props.text}
        />

        {props.attachments}

        <PromptInputFooter className='border-border/60 bg-muted/25 dark:bg-muted/15 relative z-10 border-t px-2 py-1.5 backdrop-blur-md sm:px-2.5'>
          <div className='flex w-full min-w-0 items-center justify-between gap-1.5 sm:gap-2'>
            <div className='flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden sm:gap-1'>
              {props.tools}
            </div>
            <div className='flex shrink-0 items-center gap-1.5 sm:gap-2'>
              {props.trailing}
              {props.showStop ? (
                <PromptInputButton
                  className='border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 h-9 min-w-9 touch-manipulation font-medium sm:h-8'
                  onClick={props.onStop}
                  variant='secondary'
                >
                  <SquareIcon className='fill-current' size={16} />
                  <span className='hidden sm:inline'>{t('Stop')}</span>
                  <span className='sr-only sm:hidden'>{t('Stop')}</span>
                </PromptInputButton>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PromptInputButton
                        className={cn(
                          'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground h-9 min-w-9 touch-manipulation px-3 font-medium shadow-sm sm:h-8',
                          'transition-transform active:scale-[0.97]',
                          props.canSubmit &&
                            !props.disabled &&
                            'shadow-primary/25 shadow-md'
                        )}
                        disabled={!props.canSubmit || props.disabled}
                        type='submit'
                        variant='default'
                      />
                    }
                  >
                    <SendIcon size={16} />
                    <span className='hidden sm:inline'>{t('Send')}</span>
                    <span className='sr-only sm:hidden'>{t('Send')}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('Enter to send, Shift+Enter for a new line')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
