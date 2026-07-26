/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Bot, Loader2, Sparkles, Square } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { MOTION_TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { PlaygroundView } from '@/stores/playground-store'

type PlaygroundToolbarProps = {
  view: PlaygroundView
  onViewChange: (view: PlaygroundView) => void
  isChatGenerating: boolean
  isStudioPending: boolean
  onStopChat: () => void
}

const VIEWS: Array<{
  id: PlaygroundView
  labelKey: string
  icon: typeof Sparkles
}> = [
  { id: 'workspace', labelKey: 'Workspace', icon: Sparkles },
  { id: 'agents', labelKey: 'Agents', icon: Bot },
]

/**
 * Playground-level toolbar: underline page-level view tabs on the left,
 * generation status indicator on the right.
 */
export function PlaygroundToolbar(props: PlaygroundToolbarProps) {
  const { t } = useTranslation()
  const shouldReduce = useReducedMotion()
  const generating = props.isChatGenerating || props.isStudioPending

  return (
    <div className='flex min-w-0 flex-1 items-center justify-between gap-2 self-stretch sm:gap-3'>
      <div
        className='flex h-full items-stretch gap-0.5 sm:gap-2'
        role='tablist'
        aria-label={t('Playground views')}
      >
        {VIEWS.map((view) => {
          const Icon = view.icon
          const active = props.view === view.id
          return (
            <button
              key={view.id}
              type='button'
              role='tab'
              aria-selected={active}
              aria-label={t(view.labelKey)}
              onClick={() => props.onViewChange(view.id)}
              className={cn(
                'focus-visible:ring-ring relative flex items-center gap-1.5 rounded-t-md px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 sm:px-2.5',
                active
                  ? 'text-foreground bg-gradient-to-t from-primary/10 to-transparent'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn('size-4 shrink-0', active && 'text-primary')}
                aria-hidden='true'
              />
              <span>{t(view.labelKey)}</span>
              {active &&
                (shouldReduce ? (
                  <span className='bg-primary absolute inset-x-1 bottom-0 h-0.5 rounded-full' />
                ) : (
                  <motion.span
                    layoutId='playground-view-underline'
                    className='bg-primary absolute inset-x-1 bottom-0 h-0.5 rounded-full'
                    transition={MOTION_TRANSITION.fast}
                  />
                ))}
            </button>
          )
        })}
      </div>

      {generating && (
        <div className='flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2'>
          <span className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
            <Loader2
              className='text-primary size-3.5 animate-spin'
              aria-hidden='true'
            />
            <span className='hidden md:inline'>
              {props.isChatGenerating
                ? t('Generation in progress…')
                : t('Studio task still running…')}
            </span>
          </span>
          {props.isChatGenerating && (
            <Button
              size='sm'
              variant='outline'
              className='h-8 px-2.5 sm:h-7'
              onClick={props.onStopChat}
            >
              <Square className='size-3 fill-current' aria-hidden='true' />
              <span className='hidden sm:inline'>{t('Stop')}</span>
            </Button>
          )}
          {props.view !== 'workspace' && (
            <Button
              size='sm'
              className='bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-2.5 sm:h-7'
              onClick={() => props.onViewChange('workspace')}
            >
              <span className='sm:hidden'>{t('Workspace')}</span>
              <span className='hidden sm:inline'>{t('Back to workspace')}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
