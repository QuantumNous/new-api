/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  AlertCircle,
  Download,
  Loader2,
  PenLine,
  RefreshCcw,
  X,
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useVideoTaskResult } from '../../hooks/use-video-task-result'
import { downloadGeneratedMedia } from '../../lib/download-generated-media'
import type { StudioRunSummary } from '../../lib/session/session-types'
import type {
  PendingStudioRun,
  StudioFeedBatch,
} from '../../lib/studio/studio-feed'
import { MediaLightbox, type LightboxItem } from '../media/media-lightbox'
import { GenerationProgress } from './generation-progress'
import { GenerationImageCard } from './generation-result-card'

type StudioFeedProps = {
  modality: 'image' | 'video' | 'audio'
  batches: StudioFeedBatch[]
  pending: PendingStudioRun[]
  onReusePrompt: (prompt: string) => void
  onRerun: (prompt: string) => void
  onUseAsReference?: (image: { url: string; assetId?: number }) => void
  onRetryPending: (clientId: string) => void
  onDismissPending: (clientId: string) => void
}

/**
 * Chronological generation feed: one card per request (prompt + results),
 * newest at the bottom, with in-flight runs appended as pending cards. This
 * is the continuous-creation surface — earlier results stay visible while
 * new ones generate.
 */
export function StudioFeed(props: StudioFeedProps) {
  const { t } = useTranslation()
  const shouldReduce = useReducedMotion()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState('')
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[]
    index: number
  } | null>(null)

  const totalRuns = props.batches.reduce(
    (sum, batch) => sum + batch.runs.length,
    0
  )
  const pendingCount = props.pending.length

  useEffect(() => {
    anchorRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: shouldReduce ? 'auto' : 'smooth',
    })
  }, [totalRuns, pendingCount, shouldReduce])

  const downloadMedia = async (
    url: string,
    filename: string,
    kind: 'image' | 'video' | 'audio'
  ) => {
    setDownloading(filename)
    try {
      await downloadGeneratedMedia(url, filename, kind)
      toast.success(t('Download started'))
    } catch {
      toast.error(t('Download failed'))
    } finally {
      setDownloading('')
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      {props.batches.map((batch) => (
        <article key={batch.key} className='flex flex-col gap-2.5'>
          <BatchHeader
            batch={batch}
            onReusePrompt={props.onReusePrompt}
            onRerun={props.onRerun}
          />
          {props.modality === 'image' && (
            <ImageBatchGrid
              batch={batch}
              downloading={downloading}
              onDownload={downloadMedia}
              onOpen={(items, index) => setLightbox({ items, index })}
              onUseAsReference={props.onUseAsReference}
            />
          )}
          {props.modality === 'video' &&
            batch.runs.map((run) => (
              <VideoRunContent
                key={run.id}
                run={run}
                downloading={downloading}
                onDownload={downloadMedia}
              />
            ))}
          {props.modality === 'audio' &&
            batch.runs.map((run) => (
              <AudioRunContent
                key={run.id}
                run={run}
                downloading={downloading}
                onDownload={downloadMedia}
              />
            ))}
        </article>
      ))}

      {props.pending.map((entry) => (
        <PendingRunCard
          key={entry.clientId}
          entry={entry}
          onRetry={props.onRetryPending}
          onDismiss={props.onDismissPending}
        />
      ))}

      <div ref={anchorRef} aria-hidden='true' />

      <MediaLightbox
        open={lightbox != null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null)
        }}
        items={lightbox?.items ?? []}
        index={lightbox?.index ?? 0}
        onIndexChange={(index) =>
          setLightbox((state) => (state ? { ...state, index } : state))
        }
        actions={
          props.onUseAsReference
            ? (item) => (
                <Button
                  size='sm'
                  variant='secondary'
                  className='bg-white/10 text-white hover:bg-white/20'
                  onClick={() => {
                    props.onUseAsReference?.({ url: item.url })
                    setLightbox(null)
                  }}
                >
                  <PenLine className='size-4' />
                  {t('Use as reference')}
                </Button>
              )
            : undefined
        }
      />
    </div>
  )
}

function formatBatchTime(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return ''
  const date = new Date(timestamp)
  const sameDay = new Date().toDateString() === date.toDateString()
  return new Intl.DateTimeFormat(undefined, {
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function BatchHeader(props: {
  batch: StudioFeedBatch
  onReusePrompt: (prompt: string) => void
  onRerun: (prompt: string) => void
}) {
  const { t } = useTranslation()
  const timeLabel = formatBatchTime(props.batch.createdAt)

  return (
    <header className='flex items-start justify-between gap-2'>
      <div className='min-w-0'>
        <p
          className='text-foreground/90 line-clamp-2 text-sm text-pretty'
          title={props.batch.prompt}
        >
          {props.batch.prompt || t('(no prompt)')}
        </p>
        <p className='text-muted-foreground mt-0.5 text-[11px]'>
          {[props.batch.model, timeLabel].filter(Boolean).join(' · ')}
        </p>
      </div>
      {props.batch.prompt && (
        <div className='flex shrink-0 items-center gap-0.5'>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='icon'
                  variant='ghost'
                  className='text-muted-foreground hover:text-foreground size-7'
                  aria-label={t('Edit prompt in composer')}
                  onClick={() => props.onReusePrompt(props.batch.prompt)}
                />
              }
            >
              <PenLine className='size-3.5' />
            </TooltipTrigger>
            <TooltipContent>{t('Edit prompt in composer')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='icon'
                  variant='ghost'
                  className='text-muted-foreground hover:text-foreground size-7'
                  aria-label={t('Generate again')}
                  onClick={() => props.onRerun(props.batch.prompt)}
                />
              }
            >
              <RefreshCcw className='size-3.5' />
            </TooltipTrigger>
            <TooltipContent>{t('Generate again')}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </header>
  )
}

function ImageBatchGrid(props: {
  batch: StudioFeedBatch
  downloading: string
  onDownload: (url: string, filename: string, kind: 'image') => Promise<void>
  onOpen: (items: LightboxItem[], index: number) => void
  onUseAsReference?: (image: { url: string; assetId?: number }) => void
}) {
  const { t } = useTranslation()
  const images = props.batch.runs.filter((run) => Boolean(run.resultUrl))

  if (images.length === 0) {
    return (
      <p className='text-muted-foreground border-border/70 bg-muted/30 rounded-xl border border-dashed px-3 py-4 text-center text-xs'>
        {t('Result is no longer available.')}
      </p>
    )
  }

  const lightboxItems: LightboxItem[] = images.map((run, index) => ({
    url: run.resultUrl as string,
    alt: props.batch.prompt || t('Generated image'),
    caption: props.batch.prompt,
    downloadName: `image-run-${Math.abs(run.id) || index + 1}`,
  }))

  return (
    <div
      className={cn(
        'grid w-full gap-3',
        images.length === 1
          ? 'max-w-xl grid-cols-1'
          : 'grid-cols-1 sm:grid-cols-2'
      )}
    >
      {images.map((run, index) => {
        const url = run.resultUrl as string
        const filename = `image-run-${Math.abs(run.id) || index + 1}`
        return (
          <GenerationImageCard
            key={run.id}
            url={url}
            alt={props.batch.prompt || t('Generated image')}
            filename={filename}
            index={index}
            downloading={props.downloading === filename}
            onDownload={() => void props.onDownload(url, filename, 'image')}
            onOpen={() => props.onOpen(lightboxItems, index)}
            onUseAsReference={
              props.onUseAsReference
                ? () =>
                    props.onUseAsReference?.({ url, assetId: run.assetId })
                : undefined
            }
          />
        )
      })}
    </div>
  )
}

export function AdaptiveVideoPlayer(props: { src: string }) {
  const { t } = useTranslation()
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(
    null
  )
  const aspect = videoSize ? `${videoSize.w} / ${videoSize.h}` : '16 / 9'
  return (
    <div className='relative w-full' style={{ aspectRatio: aspect }}>
      <video
        controls
        className='absolute inset-0 h-full w-full'
        src={props.src}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setVideoSize({ w: video.videoWidth, h: video.videoHeight })
          }
        }}
      >
        {t('Your browser does not support video playback.')}
      </video>
      {videoSize ? (
        <span className='bg-background/85 text-foreground/90 pointer-events-none absolute top-3 left-3 rounded-full px-2.5 py-1 font-mono text-[11px] shadow-sm backdrop-blur-sm'>
          {videoSize.w}×{videoSize.h}
        </span>
      ) : null}
    </div>
  )
}

/** A submitted video task older than this is resolved via the content URL. */
const VIDEO_POLL_MAX_AGE_MS = 10 * 60_000

function VideoRunContent(props: {
  run: StudioRunSummary
  downloading: string
  onDownload: (url: string, filename: string, kind: 'video') => Promise<void>
}) {
  const { t } = useTranslation()
  const shouldReduce = useReducedMotion()
  const { run } = props
  const shouldPoll =
    !run.resultUrl &&
    Boolean(run.taskId) &&
    (run.createdAt ?? Date.now()) > Date.now() - VIDEO_POLL_MAX_AGE_MS
  const task = useVideoTaskResult(run.taskId, shouldPoll)
  const stale =
    !run.resultUrl &&
    Boolean(run.taskId) &&
    !shouldPoll

  const src =
    run.resultUrl ||
    task.resultUrl ||
    (stale && run.taskId ? `/v1/videos/${run.taskId}/content` : '')
  const ready = Boolean(run.resultUrl) || task.ready || (stale && Boolean(src))
  const filename = `video-run-${Math.abs(run.id)}`

  if (task.failed) {
    return (
      <div className='border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-xl border px-3 py-2.5'>
        <AlertCircle className='text-destructive mt-0.5 size-4 shrink-0' />
        <p className='text-destructive text-xs text-pretty'>
          {task.failReason || t('Video generation failed.')}
        </p>
      </div>
    )
  }

  if (!ready) {
    return (
      <GenerationProgress
        modality='video'
        percent={task.percent}
        detail={run.taskId}
        className={cn(shouldReduce && 'motion-reduce:animate-none')}
      />
    )
  }

  if (!src) {
    return (
      <p className='text-muted-foreground border-border/70 bg-muted/30 rounded-xl border border-dashed px-3 py-4 text-center text-xs'>
        {t('Result is no longer available.')}
      </p>
    )
  }

  return (
    <div className='max-w-3xl space-y-2.5'>
      <div className='border-border/80 overflow-hidden rounded-2xl border bg-black shadow-sm'>
        <AdaptiveVideoPlayer src={src} />
      </div>
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='border-border bg-muted/50 text-foreground'
        disabled={props.downloading === filename}
        onClick={() => void props.onDownload(src, filename, 'video')}
      >
        {props.downloading === filename ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <Download className='size-4' />
        )}
        {t('Download video')}
      </Button>
    </div>
  )
}

function AudioRunContent(props: {
  run: StudioRunSummary
  downloading: string
  onDownload: (url: string, filename: string, kind: 'audio') => Promise<void>
}) {
  const { t } = useTranslation()
  const { run } = props
  const filename = `audio-run-${Math.abs(run.id)}`

  if (!run.resultUrl) {
    return (
      <p className='text-muted-foreground border-border/70 bg-muted/30 rounded-xl border border-dashed px-3 py-4 text-center text-xs'>
        {t('Result is no longer available.')}
      </p>
    )
  }

  return (
    <div className='border-border/80 bg-muted/40 max-w-md space-y-3 rounded-2xl border p-4 shadow-sm'>
      <div className='from-primary/10 via-muted/40 to-muted/20 rounded-xl bg-gradient-to-br px-4 py-5'>
        <audio controls className='w-full' src={run.resultUrl}>
          {t('Your browser does not support audio playback.')}
        </audio>
      </div>
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='border-border bg-muted/50 text-foreground'
        disabled={props.downloading === filename}
        onClick={() =>
          void props.onDownload(run.resultUrl as string, filename, 'audio')
        }
      >
        {props.downloading === filename ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <Download className='size-4' />
        )}
        {t('Download audio')}
      </Button>
    </div>
  )
}

function PendingRunCard(props: {
  entry: PendingStudioRun
  onRetry: (clientId: string) => void
  onDismiss: (clientId: string) => void
}) {
  const { t } = useTranslation()
  const { entry } = props

  if (entry.status === 'error') {
    return (
      <article className='border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-2xl border px-4 py-3'>
        <div className='flex items-start justify-between gap-2'>
          <p
            className='text-foreground/90 line-clamp-2 min-w-0 text-sm text-pretty'
            title={entry.input.prompt}
          >
            {entry.input.prompt}
          </p>
          <Button
            size='icon'
            variant='ghost'
            className='text-muted-foreground hover:text-foreground size-7 shrink-0'
            aria-label={t('Dismiss')}
            onClick={() => props.onDismiss(entry.clientId)}
          >
            <X className='size-3.5' />
          </Button>
        </div>
        <div className='flex items-start gap-2'>
          <AlertCircle className='text-destructive mt-0.5 size-4 shrink-0' />
          <p className='text-destructive text-xs text-pretty'>
            {entry.error || t('Generation failed.')}
          </p>
        </div>
        <div>
          <Button
            size='sm'
            variant='outline'
            onClick={() => props.onRetry(entry.clientId)}
          >
            <RefreshCcw className='size-3.5' />
            {t('Try again')}
          </Button>
        </div>
      </article>
    )
  }

  return (
    <article className='flex flex-col gap-2.5' aria-busy='true'>
      <header className='flex items-center gap-2'>
        <p
          className='text-foreground/90 line-clamp-2 min-w-0 text-sm text-pretty'
          title={entry.input.prompt}
        >
          {entry.input.prompt}
        </p>
      </header>
      <GenerationProgress
        modality={entry.input.modality}
        imageCount={
          entry.input.modality === 'image' ? entry.settings.imageCount : undefined
        }
        imageSize={
          entry.input.modality === 'image' ? entry.settings.imageSize : undefined
        }
        percent={null}
      />
    </article>
  )
}
