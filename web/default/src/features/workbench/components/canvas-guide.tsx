/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { ArrowUp, MousePointerClick, Plus, Sparkles, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

const GUIDE_STEPS = [
  {
    selector: '[data-guide="node-card"]',
    icon: Sparkles,
    title: 'Every card is one generation',
    body: 'A card holds the prompt, the model, and the result it produced. Drag the header to move it around the canvas.',
  },
  {
    selector: '[data-guide="node-prompt"]',
    icon: Wand2,
    title: 'Describe what you want here',
    body: 'Type @ to reference another card, or / to insert a prompt preset.',
  },
  {
    selector: '[data-guide="node-generate"]',
    icon: ArrowUp,
    title: 'Pick a model, then run it',
    body: 'The round button starts the generation. The result appears in the card above.',
  },
  {
    selector: '[data-guide="node-handle"]',
    icon: MousePointerClick,
    title: 'Chain cards into a flow',
    body: 'Drag the dot on the right edge onto another card to feed this result into the next step.',
  },
  {
    selector: '[data-guide="canvas-toolbar"]',
    icon: Plus,
    title: 'Add more steps from the toolbar',
    body: 'Add image, video, or note cards, change the background, and fit the view from here.',
  },
] as const

const CARD_WIDTH = 300
const CARD_HEIGHT = 210
const CARD_GAP = 16
const SPOTLIGHT_PADDING = 8

type Rect = { top: number; left: number; width: number; height: number }

function measure(selector: string): Rect | null {
  const element = document.querySelector(selector)
  if (!element) return null
  const box = element.getBoundingClientRect()
  if (box.width === 0 && box.height === 0) return null
  return {
    top: box.top - SPOTLIGHT_PADDING,
    left: box.left - SPOTLIGHT_PADDING,
    width: box.width + SPOTLIGHT_PADDING * 2,
    height: box.height + SPOTLIGHT_PADDING * 2,
  }
}

/**
 * Spotlight walkthrough for the canvas. Steps are anchored to `data-guide`
 * attributes so the tour keeps working when the surrounding layout changes.
 */
export function CanvasGuide(props: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const step = GUIDE_STEPS[index]

  const sync = useCallback(() => {
    if (!props.open) return
    setRect(measure(GUIDE_STEPS[index].selector))
  }, [index, props.open])

  useEffect(() => {
    if (!props.open) {
      setIndex(0)
      return
    }
    sync()
    const frame = window.requestAnimationFrame(sync)
    window.addEventListener('resize', sync)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', sync)
    }
  }, [props.open, sync])

  useEffect(() => {
    if (!props.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props])

  if (!props.open) return null

  const isLast = index === GUIDE_STEPS.length - 1
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const cardLeft = rect
    ? Math.min(
        Math.max(CARD_GAP, rect.left + rect.width / 2 - CARD_WIDTH / 2),
        viewportWidth - CARD_WIDTH - CARD_GAP
      )
    : viewportWidth / 2 - CARD_WIDTH / 2
  let cardTop = viewportHeight / 2 - CARD_HEIGHT / 2
  if (rect && rect.top < viewportHeight / 2) {
    cardTop = rect.top + rect.height + CARD_GAP
  } else if (rect) {
    cardTop = Math.max(CARD_GAP, rect.top - CARD_GAP - CARD_HEIGHT)
  }

  return (
    <div className='fixed inset-0 z-[70]' role='dialog' aria-modal='true'>
      {rect ? (
        <div
          className='pointer-events-none absolute rounded-2xl transition-all duration-300 ease-out'
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow:
              '0 0 0 9999px rgba(2,6,23,.62), 0 0 0 2px rgba(255,255,255,.85)',
          }}
        />
      ) : (
        <div className='absolute inset-0 bg-slate-950/60' />
      )}

      <button
        type='button'
        aria-label={t('Skip')}
        className='absolute inset-0 h-full w-full cursor-default'
        onClick={props.onClose}
      />

      <div
        className='bg-popover text-popover-foreground absolute rounded-2xl border p-4 shadow-2xl transition-all duration-300 ease-out'
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
      >
        <div className='flex items-center gap-2'>
          <span className='flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white'>
            <step.icon className='size-3.5' />
          </span>
          <p className='flex-1 text-sm font-semibold'>{t(step.title)}</p>
          <span className='text-muted-foreground text-[11px] tabular-nums'>
            {index + 1}/{GUIDE_STEPS.length}
          </span>
        </div>

        <p className='text-muted-foreground mt-2 text-xs leading-relaxed text-pretty'>
          {t(step.body)}
        </p>

        <div className='mt-4 flex items-center gap-2'>
          <Button
            size='sm'
            variant='ghost'
            className='h-8 px-2 text-xs'
            onClick={props.onClose}
          >
            {t('Skip')}
          </Button>
          <div className='ml-auto flex items-center gap-2'>
            {index > 0 ? (
              <Button
                size='sm'
                variant='outline'
                className='h-8 px-3 text-xs'
                onClick={() => setIndex((value) => value - 1)}
              >
                {t('Back')}
              </Button>
            ) : null}
            <Button
              size='sm'
              className='h-8 px-3 text-xs'
              onClick={() =>
                isLast ? props.onClose() : setIndex((value) => value + 1)
              }
            >
              {isLast ? t('Got it') : t('Next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
