/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQueryClient } from '@tanstack/react-query'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useRef, useState } from 'react'

import { usePlaygroundStore } from '@/stores/playground-store'

import {
  createPlaygroundRun,
  generateImages,
  generateSpeech,
  submitVideo,
  uploadPlaygroundAsset,
} from '../api'
import { persistGeneratedMediaAsset } from '../lib/download-generated-media'
import type { StudioRunSummary } from '../lib/session/session-types'
import {
  createLocalRunId,
  type PendingStudioRun,
  type StudioGenerationInput,
} from '../lib/studio/studio-feed'
import type { StudioSettings } from '../types'
import {
  ensureActiveStudioProjectId,
  recordActiveStudioRun,
} from './use-session-cloud-sync'

/**
 * Concurrent generation engine for the studio modalities. Every submit
 * appends a pending entry immediately (so the feed shows it), runs the
 * request, and finalizes into the owning session's run history. Multiple
 * runs may be in flight at once; failures stay on the feed with a retry.
 */
export type UseStudioResult = ReturnType<typeof useStudio>

export function useStudio() {
  const queryClient = useQueryClient()
  const settings = usePlaygroundStore((state) => state.studioSettings)
  const setSettings = usePlaygroundStore((state) => state.setStudioSettings)
  const [pendingRuns, setPendingRuns] = useState<PendingStudioRun[]>([])
  const blobUrlsRef = useRef<string[]>([])

  useEffect(
    () => () => {
      for (const url of blobUrlsRef.current) URL.revokeObjectURL(url)
      blobUrlsRef.current = []
    },
    []
  )

  const patchPending = useCallback(
    (clientId: string, patch: Partial<PendingStudioRun>) => {
      setPendingRuns((previous) =>
        previous.map((entry) =>
          entry.clientId === clientId ? { ...entry, ...patch } : entry
        )
      )
    },
    []
  )

  const removePending = useCallback((clientId: string) => {
    setPendingRuns((previous) =>
      previous.filter((entry) => entry.clientId !== clientId)
    )
  }, [])

  const finalizeRun = useCallback(
    async (input: {
      generation: StudioGenerationInput
      assetId?: number
      taskId?: string
      fallbackUrl?: string
      projectId: number
    }) => {
      const { generation } = input
      const cloudRun = await createPlaygroundRun({
        modality: generation.modality,
        model: generation.model,
        prompt: generation.prompt,
        asset_id: input.assetId,
        task_id: input.taskId,
        project_id: input.projectId || undefined,
      })
      const run: StudioRunSummary = cloudRun
        ? {
            id: cloudRun.id,
            model: cloudRun.model,
            prompt: cloudRun.prompt,
            resultUrl: cloudRun.result_url || input.fallbackUrl,
            assetId: cloudRun.asset_id,
            taskId: cloudRun.task_id,
            createdAt: cloudRun.created_at
              ? cloudRun.created_at * 1000
              : Date.now(),
          }
        : {
            id: createLocalRunId(),
            model: generation.model,
            prompt: generation.prompt,
            resultUrl: input.fallbackUrl,
            assetId: input.assetId,
            taskId: input.taskId,
            createdAt: Date.now(),
          }
      const previewUrl = run.resultUrl
      recordActiveStudioRun({
        sessionId: generation.sessionId,
        prompt: generation.prompt,
        model: generation.model,
        previewUrls:
          previewUrl &&
          !previewUrl.startsWith('data:') &&
          !previewUrl.startsWith('blob:')
            ? [previewUrl]
            : undefined,
        run,
      })
    },
    []
  )

  const executeImageRun = useCallback(
    async (generation: StudioGenerationInput, snapshot: StudioSettings) => {
      const generated = await generateImages({
        model: generation.model,
        group: generation.group,
        prompt: generation.prompt,
        settings: snapshot,
        referenceImage: generation.references[0] ?? null,
        referenceImages: generation.references.slice(1),
        editMode: generation.references.length > 0,
      })
      if (generated.length === 0) {
        throw new Error('The model returned no images.')
      }
      // Persist to same-origin assets before surfacing URLs so <img> and
      // download both work even when the provider blocks hotlinking / CORS.
      const persisted = await Promise.all(
        generated.map(async (image, index) => {
          try {
            const asset = await persistGeneratedMediaAsset(
              image.url,
              `generated-image-${index + 1}`,
              'image'
            )
            return { url: asset.url, assetId: asset.id as number | undefined }
          } catch {
            return { url: image.url, assetId: undefined }
          }
        })
      )
      const projectId = await ensureActiveStudioProjectId(generation.sessionId)
      for (const image of persisted) {
        await finalizeRun({
          generation,
          assetId: image.assetId,
          fallbackUrl: image.url,
          projectId,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['playground', 'runs'] })
    },
    [finalizeRun, queryClient]
  )

  const executeVideoRun = useCallback(
    async (generation: StudioGenerationInput, snapshot: StudioSettings) => {
      const submission = await submitVideo({
        model: generation.model,
        group: generation.group,
        prompt: generation.prompt,
        settings: snapshot,
        firstFrame: generation.references[0] ?? null,
        inputReference: generation.references[0] ?? null,
      })
      if (!submission.taskId) {
        throw new Error('The provider did not return a task id.')
      }
      const projectId = await ensureActiveStudioProjectId(generation.sessionId)
      await finalizeRun({ generation, taskId: submission.taskId, projectId })
      await queryClient.invalidateQueries({
        queryKey: ['playground', 'task-history'],
      })
      await queryClient.invalidateQueries({ queryKey: ['playground', 'runs'] })
    },
    [finalizeRun, queryClient]
  )

  const executeAudioRun = useCallback(
    async (generation: StudioGenerationInput, snapshot: StudioSettings) => {
      const blob = await generateSpeech({
        model: generation.model,
        group: generation.group,
        text: generation.prompt,
        settings: snapshot,
      })
      let assetId: number | undefined
      let resultUrl = ''
      try {
        const extension = snapshot.audioFormat || 'mp3'
        const asset = await uploadPlaygroundAsset(
          new File([blob], `speech.${extension}`, { type: blob.type }),
          'audio'
        )
        assetId = asset.id
        resultUrl = asset.url
      } catch {
        // Keep playback for this tab even when the asset upload fails.
        resultUrl = URL.createObjectURL(blob)
        blobUrlsRef.current.push(resultUrl)
      }
      const projectId = await ensureActiveStudioProjectId(generation.sessionId)
      await finalizeRun({
        generation,
        assetId,
        fallbackUrl: resultUrl,
        projectId,
      })
      await queryClient.invalidateQueries({ queryKey: ['playground', 'runs'] })
    },
    [finalizeRun, queryClient]
  )

  const executeRun = useCallback(
    async (entry: PendingStudioRun) => {
      try {
        if (entry.input.modality === 'image') {
          await executeImageRun(entry.input, entry.settings)
        } else if (entry.input.modality === 'video') {
          await executeVideoRun(entry.input, entry.settings)
        } else {
          await executeAudioRun(entry.input, entry.settings)
        }
        removePending(entry.clientId)
      } catch (error) {
        patchPending(entry.clientId, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    [
      executeAudioRun,
      executeImageRun,
      executeVideoRun,
      patchPending,
      removePending,
    ]
  )

  const startGeneration = useCallback(
    (input: StudioGenerationInput) => {
      const entry: PendingStudioRun = {
        clientId: nanoid(10),
        input,
        settings: { ...usePlaygroundStore.getState().studioSettings },
        startedAt: Date.now(),
        status: 'running',
      }
      setPendingRuns((previous) => [...previous, entry])
      void executeRun(entry)
    },
    [executeRun]
  )

  const retryRun = useCallback(
    (clientId: string) => {
      const entry = pendingRuns.find((item) => item.clientId === clientId)
      if (!entry || entry.status !== 'error') return
      const next: PendingStudioRun = {
        ...entry,
        status: 'running',
        error: undefined,
        startedAt: Date.now(),
      }
      setPendingRuns((previous) =>
        previous.map((item) => (item.clientId === clientId ? next : item))
      )
      void executeRun(next)
    },
    [executeRun, pendingRuns]
  )

  return {
    settings,
    setSettings,
    pendingRuns,
    startGeneration,
    retryRun,
    dismissRun: removePending,
  }
}
