/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { PricingModel } from '@/features/pricing/types'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/stores/playground-store'

import { fetchPlaygroundAssetBlob } from '../../api'
import type { UseStudioResult } from '../../hooks/use-studio'
import { isStudioSession } from '../../lib'
import { isPlaygroundImageModel } from '../../lib/studio/image-request-schema'
import { groupRunsIntoBatches } from '../../lib/studio/studio-feed'
import type { StudioModality } from '../../types'
import type { MediaReference } from '../composer/attachments/media-reference-slot'
import { GenerationComposer } from '../composer/generation-composer'
import { ModelHero } from './model-hero'
import { StudioFeed } from './studio-feed'

type GenerationWorkspaceProps = {
  modality: Exclude<StudioModality, 'chat'>
  pricingModel?: PricingModel
  canSubmit: () => boolean
  studio: UseStudioResult
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () =>
      reject(new Error('Could not read media blob'))
    )
    reader.readAsDataURL(blob)
  })
}

/**
 * Continuous generation workspace: a chronological feed of prompt + result
 * cards (restored from the session's run history) with the composer docked
 * at the bottom. Submitting never blocks on a running generation — new runs
 * append to the feed as pending cards.
 */
export function GenerationWorkspace(props: GenerationWorkspaceProps) {
  const { t } = useTranslation()
  const { studio } = props
  const [references, setReferences] = useState<MediaReference[]>([])
  const [referenceModality, setReferenceModality] = useState(props.modality)

  const model = usePlaygroundStore((state) => state.config.model)
  const group = usePlaygroundStore((state) => state.config.group)
  const setPrefill = usePlaygroundStore((state) => state.setPrefill)
  const activeModality = usePlaygroundStore((state) => state.activeModality)
  const activeSessionId = usePlaygroundStore(
    (state) => state.activeSessionByModality[state.activeModality] ?? null
  )
  const session = usePlaygroundStore((state) =>
    state.sessions.find((item) => item.id === activeSessionId)
  )

  // References carry the editing chain within a modality; switching between
  // image and video (different reference semantics) clears them.
  if (referenceModality !== props.modality) {
    setReferenceModality(props.modality)
    setReferences([])
  }

  const studioSession =
    session && isStudioSession(session) && session.modality === props.modality
      ? session
      : null
  const batches = useMemo(
    () => groupRunsIntoBatches(studioSession?.runs),
    [studioSession?.runs]
  )
  const pending = useMemo(
    () =>
      studio.pendingRuns.filter(
        (entry) =>
          entry.input.modality === props.modality &&
          (!studioSession || entry.input.sessionId === studioSession.id)
      ),
    [studio.pendingRuns, props.modality, studioSession]
  )

  const showHero = batches.length === 0 && pending.length === 0
  const hasRunning = pending.some((entry) => entry.status === 'running')

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
    let sessionId = studioSession?.id
    if (!sessionId) {
      usePlaygroundStore.getState().startNewSession(props.modality)
      sessionId =
        usePlaygroundStore.getState().activeSessionByModality[props.modality] ??
        undefined
    }
    if (!sessionId) return
    const referenceUrls =
      props.modality === 'audio'
        ? []
        : references
            .map((reference) => reference.dataUrl)
            .slice(0, props.modality === 'image' ? 4 : 1)
    studio.startGeneration({
      modality: props.modality,
      sessionId,
      prompt,
      model,
      group,
      references: referenceUrls,
    })
  }

  const addReferenceFromResult = async (image: {
    url: string
    assetId?: number
  }) => {
    const maxFiles = props.modality === 'image' ? 4 : 1
    try {
      const blob = image.assetId
        ? await fetchPlaygroundAssetBlob(image.assetId)
        : await (await fetch(image.url)).blob()
      const dataUrl = await blobToDataUrl(blob)
      if (!dataUrl.startsWith('data:image/')) {
        throw new Error('not an image')
      }
      setReferences((previous) => {
        const next = [
          ...previous,
          {
            id: crypto.randomUUID(),
            name: t('Generated image'),
            dataUrl,
            assetId: image.assetId,
          },
        ]
        return next.slice(-maxFiles)
      })
      toast.success(t('Added as reference. Describe your edit and send.'))
    } catch {
      toast.error(t('Could not load this image as a reference.'))
    }
  }

  const supportsReferences =
    props.modality === 'image' || props.modality === 'video'

  return (
    <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        {showHero ? (
          <ModelHero
            model={props.pricingModel}
            modelName={model}
            modality={props.modality}
          />
        ) : (
          <div className='mx-auto w-full max-w-5xl px-3 pt-4 pb-6 sm:px-4 md:px-6'>
            <StudioFeed
              modality={props.modality}
              batches={batches}
              pending={pending}
              onReusePrompt={(prompt) => setPrefill(prompt)}
              onRerun={(prompt) => submit(prompt)}
              onUseAsReference={
                supportsReferences
                  ? (image) => void addReferenceFromResult(image)
                  : undefined
              }
              onRetryPending={studio.retryRun}
              onDismissPending={studio.dismissRun}
            />
          </div>
        )}
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
          isPending={hasRunning && activeModality === props.modality}
          references={references}
          onReferencesChange={setReferences}
          onSubmit={submit}
        />
      </div>
    </div>
  )
}
