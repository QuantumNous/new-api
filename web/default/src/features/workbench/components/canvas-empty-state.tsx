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
      <div className='landing-animate-scale-in border-border/60 bg-background/85 pointer-events-auto w-full max-w-xl rounded-2xl border p-6 shadow-2xl backdrop-blur-2xl sm:p-7'>
        <p className='text-primary/90 text-[11px] font-semibold tracking-[0.2em] uppercase'>
          {t('Canvas')}
        </p>
        <h2 className='mt-1.5 text-lg font-semibold tracking-tight'>
          {t('Start your first flow')}
        </h2>
        <p className='text-muted-foreground mt-1 text-sm text-pretty'>
          {t(
            'A canvas is a chain of cards. Each card generates something, and its result can feed the next card.'
          )}
        </p>

        <div className='mt-5 grid gap-2.5 sm:grid-cols-3'>
          {STARTERS.map((starter) => (
            <button
              key={starter.kind}
              type='button'
              onClick={() => props.onStart(starter.kind)}
              className='border-border/60 hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-ring group rounded-xl border p-3.5 text-left transition-[border-color,background-color,transform] duration-200 outline-none hover:-translate-y-0.5 focus-visible:ring-2'
            >
              <span
                className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-transform duration-200 group-hover:scale-105 ${starter.chip}`}
              >
                <starter.icon className='size-4' />
              </span>
              <span className='mt-2.5 block text-[13px] font-semibold'>
                {t(starter.title)}
              </span>
              <span className='text-muted-foreground mt-0.5 block text-xs text-pretty'>
                {t(starter.body)}
              </span>
            </button>
          ))}
        </div>

        <div className='border-border/60 mt-5 flex items-center justify-between gap-3 border-t pt-4'>
          <p className='text-muted-foreground text-xs'>
            {t('You can also drop an image or paste a link onto the canvas.')}
          </p>
          <Button
            size='sm'
            variant='ghost'
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
