/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  Film,
  HelpCircle,
  Image as ImageIcon,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export type CanvasStarterKind = 'image' | 'image-to-video' | 'note'

const STARTERS: Array<{
  kind: CanvasStarterKind
  icon: LucideIcon
  title: string
  body: string
  chip: string
}> = [
  {
    kind: 'image',
    icon: ImageIcon,
    title: 'Generate an image',
    body: 'One card: write a prompt, pick a model, run it.',
    chip: 'from-violet-500 to-fuchsia-500',
  },
  {
    kind: 'image-to-video',
    icon: Film,
    title: 'Turn an image into a video',
    body: 'Two connected cards: the image feeds the video step.',
    chip: 'from-sky-500 to-cyan-500',
  },
  {
    kind: 'note',
    icon: StickyNote,
    title: 'Jot down an idea',
    body: 'A note card to park references and prompt fragments.',
    chip: 'from-amber-400 to-orange-500',
  },
]

/**
 * Shown on an empty canvas. A blank grid gives no signal about what a canvas
 * is for, so the first screen states the three shapes a flow can take.
 */
export function CanvasEmptyState(props: {
  onStart: (kind: CanvasStarterKind) => void
  onShowGuide: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className='pointer-events-none absolute inset-0 flex items-center justify-center p-6 pb-24'>
      <div className='bg-background/85 pointer-events-auto w-full max-w-2xl rounded-3xl border p-6 shadow-xl backdrop-blur-xl sm:p-8'>
        <h2 className='text-lg font-semibold tracking-tight'>
          {t('Start your first flow')}
        </h2>
        <p className='text-muted-foreground mt-1 text-sm text-pretty'>
          {t(
            'A canvas is a chain of cards. Each card generates something, and its result can feed the next card.'
          )}
        </p>

        <div className='mt-5 grid gap-3 sm:grid-cols-3'>
          {STARTERS.map((starter) => (
            <button
              key={starter.kind}
              type='button'
              onClick={() => props.onStart(starter.kind)}
              className='border-border/70 hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-ring group rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2'
            >
              <span
                className={`flex size-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-105 ${starter.chip}`}
              >
                <starter.icon className='size-4' />
              </span>
              <span className='mt-3 block text-sm font-semibold'>
                {t(starter.title)}
              </span>
              <span className='text-muted-foreground mt-1 block text-xs text-pretty'>
                {t(starter.body)}
              </span>
            </button>
          ))}
        </div>

        <div className='mt-5 flex items-center justify-between gap-3'>
          <p className='text-muted-foreground text-xs'>
            {t('You can also drop an image or paste a link onto the canvas.')}
          </p>
          <Button
            size='sm'
            variant='outline'
            className='shrink-0 gap-1.5'
            onClick={props.onShowGuide}
          >
            <HelpCircle className='size-3.5' />
            {t('Show me how')}
          </Button>
        </div>
      </div>
    </div>
  )
}
