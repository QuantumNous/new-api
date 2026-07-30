/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { ImageIcon, Music2, Video } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Shimmer } from '@/components/ai-elements/shimmer'
import { MOTION_TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'

import type { StudioModality } from '../../types'

type GenerationProgressProps = {
  modality: Exclude<StudioModality, 'chat'>
  /** Number of image placeholders while generating */
  imageCount?: number
  /** Target image size (e.g. 1024x1536) — drives placeholder aspect ratio */
  imageSize?: string
  /** Soft progress 0–100 when the backend reports none (video indeterminate) */
  percent?: number | null
  /** Optional secondary status line (e.g. video task id) */
  detail?: string
  className?: string
}

function parseSizeAspect(size?: string): {
  ratio: number
  label: string | null
  css: string
} {
  if (!size) return { ratio: 1, label: null, css: '1 / 1' }
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim())
  if (!match) return { ratio: 1, label: size, css: '1 / 1' }
  const w = Number(match[1])
  const h = Number(match[2])
  if (!w || !h) return { ratio: 1, label: size, css: '1 / 1' }
  return { ratio: w / h, label: `${w}×${h}`, css: `${w} / ${h}` }
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min <= 0) return `${sec}s`
  return `${min}:${String(sec).padStart(2, '0')}`
}

const STATUS_KEYS: Record<Exclude<StudioModality, 'chat'>, string[]> = {
  image: [
    'Composing the scene…',
    'Painting details…',
    'Refining lighting…',
    'Almost ready…',
  ],
  video: [
    'Storyboarding frames…',
    'Rendering motion…',
    'Encoding video…',
    'Finishing touches…',
  ],
  audio: [
    'Preparing voice…',
    'Synthesizing speech…',
    'Balancing tone…',
    'Almost ready…',
  ],
}

/**
 * Full-bleed generation state: shimmering placeholders, rotating status copy,
 * and a soft progress bar. Respects reduced-motion preferences.
 */
export function GenerationProgress(props: GenerationProgressProps) {
  const { t } = useTranslation()
  const shouldReduce = useReducedMotion()
  const statuses = STATUS_KEYS[props.modality]
  const [statusIndex, setStatusIndex] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const sizeMeta = parseSizeAspect(props.imageSize)

  useEffect(() => {
    if (shouldReduce) return
    const id = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % statuses.length)
    }, 2800)
    return () => window.clearInterval(id)
  }, [shouldReduce, statuses.length])

  useEffect(() => {
    const started = performance.now()
    setElapsedMs(0)
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - started)
    }, 200)
    return () => window.clearInterval(id)
  }, [])

  const count = Math.min(Math.max(props.imageCount ?? 1, 1), 4)
  const hasHardPercent =
    typeof props.percent === 'number' &&
    Number.isFinite(props.percent) &&
    props.percent > 0
  const softPercent = hasHardPercent
    ? Math.min(100, Math.max(0, props.percent as number))
    : null
  const elapsedLabel = formatElapsed(elapsedMs)

  return (
    <div
      className={cn(
        'generation-progress-enter flex w-full flex-col gap-5',
        props.className
      )}
      role='status'
      aria-live='polite'
      aria-label={t('Generating… {{elapsed}}', { elapsed: elapsedLabel })}
    >
      {props.modality === 'image' && (
        <div
          className={cn(
            'grid w-full gap-3',
            count === 1
              ? 'mx-auto max-w-xl grid-cols-1'
              : 'grid-cols-1 sm:grid-cols-2'
          )}
        >
          {(['slot-a', 'slot-b', 'slot-c', 'slot-d'] as const)
            .slice(0, count)
            .map((id, i) => (
              <ImagePlaceholder
                key={id}
                delayMs={shouldReduce ? 0 : i * 80}
                reduceMotion={Boolean(shouldReduce)}
                aspectCss={sizeMeta.css}
                sizeLabel={sizeMeta.label}
              />
            ))}
        </div>
      )}

      {props.modality === 'video' && (
        <VideoPlaceholder reduceMotion={Boolean(shouldReduce)} />
      )}

      {props.modality === 'audio' && (
        <AudioPlaceholder reduceMotion={Boolean(shouldReduce)} />
      )}

      <div className='mx-auto flex w-full max-w-md flex-col items-center gap-3 px-2 text-center'>
        <div className='flex items-center gap-2'>
          <span
            className={cn(
              'bg-primary/15 text-primary inline-flex size-8 items-center justify-center rounded-full',
              !shouldReduce && 'generation-orb-pulse'
            )}
            aria-hidden='true'
          >
            <ModalityGlyph modality={props.modality} />
          </span>
          <AnimatePresence mode='wait' initial={false}>
            <motion.div
              key={statusIndex}
              initial={shouldReduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduce ? undefined : { opacity: 0, y: -4 }}
              transition={MOTION_TRANSITION.fast}
            >
              <Shimmer className='text-sm font-medium' duration={2.4}>
                {t(statuses[statusIndex] ?? statuses[0])}
              </Shimmer>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs tabular-nums'>
          <span className='generation-timer inline-flex items-center gap-1.5'>
            <span
              className={cn(
                'bg-primary size-1.5 rounded-full',
                !shouldReduce && 'generation-timer-dot'
              )}
              aria-hidden='true'
            />
            <span className='text-foreground/90 font-medium'>
              {elapsedLabel}
            </span>
            <span className='sr-only'>{t('Elapsed time')}</span>
          </span>
          {sizeMeta.label && props.modality === 'image' && (
            <span className='bg-muted/80 text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[11px]'>
              {sizeMeta.label}
            </span>
          )}
          {softPercent !== null && (
            <span className='font-medium'>{Math.round(softPercent)}%</span>
          )}
        </div>

        {props.detail && (
          <p className='text-muted-foreground max-w-full truncate font-mono text-[11px]'>
            {props.detail}
          </p>
        )}

        <div className='bg-muted relative h-1.5 w-full overflow-hidden rounded-full'>
          {softPercent !== null ? (
            // Scale rather than width: the bar ticks every few hundred ms and a
            // width transition relayouts the whole progress block each frame.
            <div
              className='bg-primary absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none'
              style={{
                transform: `scaleX(${Math.min(Math.max(softPercent, 0), 100) / 100})`,
              }}
            />
          ) : (
            <div
              className={cn(
                'from-primary/10 via-primary to-primary/10 absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r',
                !shouldReduce && 'generation-indeterminate'
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ModalityGlyph(props: { modality: Exclude<StudioModality, 'chat'> }) {
  if (props.modality === 'image') return <ImageIcon className='size-4' />
  if (props.modality === 'video') return <Video className='size-4' />
  return <Music2 className='size-4' />
}

export function ImagePlaceholder(props: {
  delayMs: number
  reduceMotion: boolean
  aspectCss: string
  sizeLabel: string | null
}) {
  return (
    <div
      className={cn(
        'border-border/70 bg-muted/40 relative w-full overflow-hidden rounded-2xl border',
        !props.reduceMotion && 'generation-slot-enter'
      )}
      style={{
        aspectRatio: props.aspectCss,
        animationDelay: props.reduceMotion ? undefined : `${props.delayMs}ms`,
      }}
    >
      <div className='skeleton-shimmer absolute inset-0' />
      {!props.reduceMotion && (
        <div
          className='generation-scanline pointer-events-none absolute inset-x-0 h-1/3 opacity-70'
          aria-hidden='true'
        />
      )}
      <div className='absolute inset-0 flex flex-col items-center justify-center gap-2'>
        <div
          className={cn(
            'bg-background/40 text-muted-foreground flex size-14 items-center justify-center rounded-full backdrop-blur-sm',
            !props.reduceMotion && 'generation-orb-pulse'
          )}
        >
          <ImageIcon className='size-6 opacity-70' aria-hidden='true' />
        </div>
        {props.sizeLabel && (
          <span className='bg-background/55 text-muted-foreground rounded-full px-2.5 py-0.5 font-mono text-[11px] backdrop-blur-sm'>
            {props.sizeLabel}
          </span>
        )}
      </div>
    </div>
  )
}

export function VideoPlaceholder(props: { reduceMotion: boolean }) {
  return (
    <div className='border-border/70 bg-muted/40 relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border'>
      <div className='skeleton-shimmer absolute inset-0' />
      <div className='absolute inset-0 flex flex-col items-center justify-center gap-3'>
        <div
          className={cn(
            'bg-background/50 text-muted-foreground flex size-16 items-center justify-center rounded-full backdrop-blur-sm',
            !props.reduceMotion && 'animate-pulse'
          )}
        >
          <Video className='size-7 opacity-80' aria-hidden='true' />
        </div>
        <div className='flex gap-1.5'>
          {(['d0', 'd1', 'd2'] as const).map((id, i) => (
            <span
              key={id}
              className={cn(
                'bg-muted-foreground/40 size-1.5 rounded-full',
                !props.reduceMotion && 'animate-bounce'
              )}
              style={
                props.reduceMotion
                  ? undefined
                  : { animationDelay: `${i * 120}ms` }
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function AudioPlaceholder(props: { reduceMotion: boolean }) {
  const bars = [
    { id: 'b0', h: 0.35 },
    { id: 'b1', h: 0.7 },
    { id: 'b2', h: 0.5 },
    { id: 'b3', h: 0.9 },
    { id: 'b4', h: 0.45 },
    { id: 'b5', h: 0.75 },
    { id: 'b6', h: 0.4 },
    { id: 'b7', h: 0.85 },
    { id: 'b8', h: 0.55 },
    { id: 'b9', h: 0.65 },
  ]
  return (
    <div className='border-border/70 bg-muted/40 mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border px-6 py-8'>
      <div
        className={cn(
          'bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full',
          !props.reduceMotion && 'animate-pulse'
        )}
      >
        <Music2 className='size-6' aria-hidden='true' />
      </div>
      <div className='flex h-12 items-end gap-1' aria-hidden='true'>
        {bars.map((bar, i) => (
          <span
            key={bar.id}
            className={cn(
              'bg-primary/70 w-1.5 rounded-full',
              !props.reduceMotion && 'generation-wave'
            )}
            style={{
              height: `${bar.h * 100}%`,
              animationDelay: props.reduceMotion ? undefined : `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}


