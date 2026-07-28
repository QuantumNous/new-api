/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Check, Download, Loader2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { PricingModel } from '@/features/pricing/types'
import { MOTION_TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/stores/playground-store'

import type { UseStudioResult } from '../../hooks/use-studio'
import { useVideoTaskResult } from '../../hooks/use-video-task-result'
import { downloadGeneratedMedia } from '../../lib/download-generated-media'
import { isPlaygroundImageModel } from '../../lib/studio/image-request-schema'
import type { StudioModality } from '../../types'
import type { MediaReference } from '../composer/attachments/media-reference-slot'
import { GenerationComposer } from '../composer/generation-composer'
import { GenerationErrorState, GenerationProgress } from './generation-progress'
import {
  GenerationImageCard,
  GenerationMediaResult,
} from './generation-result-card'
import { ModelHero } from './model-hero'

type GenerationWorkspaceProps = {
  modality: Exclude<StudioModality, 'chat'>
  pricingModel?: PricingModel
  canSubmit: () => boolean
  studio: UseStudioResult
}

/**
 * Generation workspace: result gallery in normal flow with the generation
 * composer docked at the bottom of the column (no floating overlay).
 * Model, group and settings come from the shared store; mutations and
 * transient results come from `useStudio` via the `studio` bundle.
 */
export function GenerationWorkspace(props: GenerationWorkspaceProps) {
  const { t } = useTranslation()
  const shouldReduce = useReducedMotion()
  const { studio } = props
  const [references, setReferences] = useState<MediaReference[]>([])
  const [referenceKey, setReferenceKey] = useState('')
  const [downloading, setDownloading] = useState('')
  const [downloadDone, setDownloadDone] = useState('')

  const model = usePlaygroundStore((state) => state.config.model)
  const group = usePlaygroundStore((state) => state.config.group)
  const imageCount = usePlaygroundStore(
    (state) => state.studioSettings.imageCount
  )
  const imageSize = usePlaygroundStore(
    (state) => state.studioSettings.imageSize
  )

  // Reset the media reference when the modality or model changes.
  const currentKey = `${props.modality}:${model}`
  if (referenceKey !== currentKey) {
    setReferenceKey(currentKey)
    setReferences([])
  }

  const videoTaskId = studio.video?.taskId ?? ''
  const videoTask = useVideoTaskResult(
    videoTaskId,
    props.modality === 'video' && Boolean(studio.video)
  )

  let isPending = studio.audioMutation.isPending
  let error = studio.audioMutation.error
  if (props.modality === 'image') {
    isPending = studio.imageMutation.isPending
    error = studio.imageMutation.error
  } else if (props.modality === 'video') {
    isPending = studio.videoMutation.isPending
    error = studio.videoMutation.error
  }

  const videoWaiting =
    props.modality === 'video' &&
    Boolean(studio.video) &&
    !videoTask.ready &&
    !videoTask.failed

  const showProgress = isPending || videoWaiting

  const hasOutput =
    (props.modality === 'image' && studio.images.length > 0 && !isPending) ||
    (props.modality === 'video' && Boolean(studio.video) && videoTask.ready) ||
    (props.modality === 'audio' && Boolean(studio.audioUrl) && !isPending)

  const showHero = !hasOutput && !showProgress && !error && !videoTask.failed

  const [lastPrompt, setLastPrompt] = useState('')

  useEffect(() => {
    if (!downloadDone) return
    const id = window.setTimeout(() => setDownloadDone(''), 1600)
    return () => window.clearTimeout(id)
  }, [downloadDone])

  const downloadMedia = async (
    sourceUrl: string,
    filename: string,
    kind: 'image' | 'video' | 'audio'
  ) => {
    setDownloading(filename)
    try {
      await downloadGeneratedMedia(sourceUrl, filename, kind)
      setDownloadDone(filename)
      toast.success(t('Download started'))
    } catch {
      toast.error(t('Download failed'))
    } finally {
      setDownloading('')
    }
  }

  const submit = (prompt: string) => {
    if (!prompt || !model) return
    if (!props.canSubmit()) return
    if (props.modality === 'image' && !isPlaygroundImageModel(model)) {
      toast.error(
        t(
          'Playground image generation uses GPT-format models only (gpt-image-2 or grok-imagine-image). Select one and try again.'
        )
      )
      return
    }
    setLastPrompt(prompt)
    const settings = usePlaygroundStore.getState().studioSettings
    const referenceUrls = references.map((reference) => reference.dataUrl)
    const refUrl = referenceUrls[0] ?? null
    const common = { model, group, settings }
    if (props.modality === 'image') {
      studio.imageMutation.mutate({
        ...common,
        prompt,
        referenceImage: refUrl,
        referenceImages: referenceUrls.slice(1),
        editMode: referenceUrls.length > 0,
      })
    } else if (props.modality === 'video') {
      studio.videoMutation.mutate({
        ...common,
        prompt,
        firstFrame: refUrl,
        inputReference: refUrl,
      })
    } else {
      studio.audioMutation.mutate({ ...common, text: prompt })
    }
  }

  const videoFilename = `video-${videoTaskId}`

  const downloadIcon = (filename: string) => {
    if (downloading === filename) {
      return <Loader2 className='size-4 animate-spin' />
    }
    if (downloadDone === filename) {
      return <Check className='size-4 text-emerald-500' />
    }
    return <Download className='size-4' />
  }

  const downloadLabel = (filename: string, idleLabel: string) =>
    downloadDone === filename ? t('Saved') : idleLabel

  return (
    <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <AnimatePresence mode='wait' initial={false}>
          {showHero && (
            <motion.div
              key={`hero-${props.modality}`}
              exit={
                shouldReduce
                  ? undefined
                  : { opacity: 0, y: -8, transition: MOTION_TRANSITION.fast }
              }
            >
              <ModelHero
                model={props.pricingModel}
                modelName={model}
                modality={props.modality}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className='mx-auto w-full max-w-5xl px-3 pb-5 sm:px-4 md:px-6 md:pb-6'>
          <section
            className={cn(
              'flex min-h-[10rem] flex-col sm:min-h-[12rem]',
              showProgress || hasOutput || error ? 'pt-3 sm:pt-4 md:pt-6' : ''
            )}
            aria-busy={showProgress}
            aria-live='polite'
          >
            <AnimatePresence mode='wait' initial={false}>
              {showProgress && (
                <motion.div
                  key='progress'
                  initial={shouldReduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduce ? undefined : { opacity: 0 }}
                  transition={MOTION_TRANSITION.fast}
                >
                  <GenerationProgress
                    modality={props.modality}
                    imageCount={
                      props.modality === 'image' ? imageCount : undefined
                    }
                    imageSize={
                      props.modality === 'image' ? imageSize : undefined
                    }
                    percent={
                      props.modality === 'video' ? videoTask.percent : null
                    }
                    detail={
                      props.modality === 'video' && studio.video
                        ? studio.video.taskId
                        : undefined
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {!showProgress &&
              props.modality === 'image' &&
              studio.images.length > 0 && (
                <div
                  className={cn(
                    'grid w-full gap-3',
                    studio.images.length === 1
                      ? 'mx-auto max-w-xl grid-cols-1'
                      : 'grid-cols-1 sm:grid-cols-2'
                  )}
                >
                  {studio.images.map((image, index) => {
                    const filename = `generated-image-${index + 1}`
                    return (
                      <GenerationImageCard
                        key={image.url}
                        url={image.url}
                        alt={image.revisedPrompt || t('Generated image')}
                        caption={image.revisedPrompt}
                        filename={filename}
                        index={index}
                        requestedSize={imageSize}
                        downloading={downloading === filename}
                        onDownload={() =>
                          void downloadMedia(image.url, filename, 'image')
                        }
                      />
                    )
                  })}
                </div>
              )}

            {!showProgress &&
              props.modality === 'video' &&
              studio.video &&
              videoTask.ready && (
                <GenerationMediaResult className='max-w-3xl'>
                  <div className='border-border/80 overflow-hidden rounded-2xl border bg-black shadow-sm'>
                    <video
                      controls
                      autoPlay
                      className='aspect-video w-full'
                      src={videoTask.resultUrl}
                    >
                      {t('Your browser does not support video playback.')}
                    </video>
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='border-border bg-muted/50 text-foreground'
                    disabled={downloading === videoFilename}
                    onClick={() =>
                      void downloadMedia(
                        videoTask.resultUrl,
                        videoFilename,
                        'video'
                      )
                    }
                  >
                    {downloadIcon(videoFilename)}
                    {downloadLabel(videoFilename, t('Download video'))}
                  </Button>
                </GenerationMediaResult>
              )}

            {props.modality === 'video' && studio.video && videoTask.failed && (
              <GenerationErrorState
                message={videoTask.failReason || t('Video generation failed.')}
                onRetry={() => submit(lastPrompt)}
                retryDisabled={!lastPrompt}
              />
            )}

            {!showProgress && props.modality === 'audio' && studio.audioUrl && (
              <GenerationMediaResult className='max-w-md'>
                <div className='border-border/80 bg-muted/40 space-y-4 rounded-2xl border p-5 shadow-sm'>
                  <div className='from-primary/10 via-muted/40 to-muted/20 rounded-xl bg-gradient-to-br px-4 py-6'>
                    <audio
                      controls
                      autoPlay
                      className='w-full'
                      src={studio.audioUrl}
                    >
                      {t('Your browser does not support audio playback.')}
                    </audio>
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='border-border bg-muted/50 text-foreground'
                    disabled={downloading === 'speech'}
                    onClick={() =>
                      void downloadMedia(studio.audioUrl, 'speech', 'audio')
                    }
                  >
                    {downloadIcon('speech')}
                    {downloadLabel('speech', t('Download audio'))}
                  </Button>
                </div>
              </GenerationMediaResult>
            )}

            {error && !showProgress && (
              <GenerationErrorState
                message={error.message || t('Generation failed.')}
                onRetry={() => submit(lastPrompt)}
                retryDisabled={!lastPrompt}
              />
            )}
          </section>
        </div>
      </div>

      <div
        className={cn(
          'playground-composer-dock border-border/60 bg-background/85 shrink-0 border-t backdrop-blur-xl',
          'supports-backdrop-filter:bg-background/72'
        )}
      >
        <GenerationComposer
          modality={props.modality}
          pricingModel={props.pricingModel}
          isPending={showProgress}
          references={references}
          onReferencesChange={setReferences}
          onSubmit={submit}
        />
      </div>
    </div>
  )
}
