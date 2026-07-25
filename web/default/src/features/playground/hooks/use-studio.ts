/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { usePlaygroundStore } from '@/stores/playground-store'

import {
  createPlaygroundRun,
  generateImages,
  generateSpeech,
  submitVideo,
  uploadPlaygroundAsset,
} from '../api'
import { persistGeneratedMediaAsset } from '../lib/download-generated-media'
import type { GeneratedImage, VideoSubmission } from '../types'
import {
  ensureActiveStudioProjectId,
  recordActiveStudioRun,
} from './use-session-cloud-sync'

/**
 * Generation results and mutations for the studio modalities. Settings live
 * in the shared playground store (persisted, migrated); the transient
 * results below reset when the playground unmounts, matching the previous
 * behavior.
 */
export type UseStudioResult = ReturnType<typeof useStudio>

export function useStudio() {
  const queryClient = useQueryClient()
  const settings = usePlaygroundStore((state) => state.studioSettings)
  const setSettings = usePlaygroundStore((state) => state.setStudioSettings)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [video, setVideo] = useState<VideoSubmission | null>(null)
  const [audioUrl, setAudioUrl] = useState('')

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    },
    [audioUrl]
  )

  const imageMutation = useMutation({
    // Persist to same-origin assets before surfacing URLs so <img> and
    // download both work even when the provider blocks hotlinking / CORS.
    mutationFn: async (variables: Parameters<typeof generateImages>[0]) => {
      const generated = await generateImages(variables)
      const persisted = await Promise.all(
        generated.map(async (image, index) => {
          try {
            const asset = await persistGeneratedMediaAsset(
              image.url,
              `generated-image-${index + 1}`,
              'image'
            )
            return {
              url: asset.url,
              revisedPrompt: image.revisedPrompt,
              assetId: asset.id,
            }
          } catch {
            // Fall back to the original URL (with no-referrer on display).
            return { ...image, assetId: undefined as number | undefined }
          }
        })
      )
      return persisted
    },
    onSuccess: (images, variables) => {
      setImages(images)
      const previewUrls = images
        .map((image) => image.url)
        .filter((url) => !url.startsWith('data:') && !url.startsWith('blob:'))
      recordActiveStudioRun({
        prompt: variables.prompt,
        model: variables.model,
        previewUrls,
      })
      void (async () => {
        const projectId = await ensureActiveStudioProjectId()
        await Promise.allSettled(
          images.map(async (image) => {
            if (!image.assetId) return
            const run = await createPlaygroundRun({
              modality: 'image',
              model: variables.model,
              prompt: variables.prompt,
              asset_id: image.assetId,
              project_id: projectId || undefined,
            })
            if (run) {
              recordActiveStudioRun({
                prompt: variables.prompt,
                model: variables.model,
                previewUrls: run.result_url ? [run.result_url] : undefined,
                run: {
                  id: run.id,
                  model: run.model,
                  prompt: run.prompt,
                  resultUrl: run.result_url,
                  assetId: run.asset_id,
                  taskId: run.task_id,
                  createdAt: run.created_at
                    ? run.created_at * 1000
                    : Date.now(),
                },
              })
            }
          })
        )
        await queryClient.invalidateQueries({
          queryKey: ['playground', 'runs'],
        })
      })()
    },
  })
  const videoMutation = useMutation({
    mutationFn: submitVideo,
    onSuccess: (submission, variables) => {
      setVideo(submission)
      recordActiveStudioRun({
        prompt: variables.prompt,
        model: variables.model,
      })
      void (async () => {
        const projectId = await ensureActiveStudioProjectId()
        const run = await createPlaygroundRun({
          modality: 'video',
          model: variables.model,
          prompt: variables.prompt,
          task_id: submission.taskId,
          project_id: projectId || undefined,
        })
        if (run) {
          recordActiveStudioRun({
            prompt: variables.prompt,
            model: variables.model,
            run: {
              id: run.id,
              model: run.model,
              prompt: run.prompt,
              resultUrl: run.result_url,
              assetId: run.asset_id,
              taskId: run.task_id,
              createdAt: run.created_at ? run.created_at * 1000 : Date.now(),
            },
          })
        }
        await queryClient.invalidateQueries({
          queryKey: ['playground', 'task-history'],
        })
        await queryClient.invalidateQueries({
          queryKey: ['playground', 'runs'],
        })
      })()
    },
  })
  const audioMutation = useMutation({
    mutationFn: generateSpeech,
    onSuccess: (blob, variables) => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(URL.createObjectURL(blob))
      recordActiveStudioRun({
        prompt: variables.text,
        model: variables.model,
      })
      void (async () => {
        let assetId: number
        try {
          const extension = variables.settings.audioFormat || 'mp3'
          const asset = await uploadPlaygroundAsset(
            new File([blob], `speech.${extension}`, { type: blob.type }),
            'audio'
          )
          assetId = asset.id
        } catch {
          // Playback remains available without creating a broken saved run.
          return
        }
        const projectId = await ensureActiveStudioProjectId()
        const run = await createPlaygroundRun({
          modality: 'audio',
          model: variables.model,
          prompt: variables.text,
          asset_id: assetId,
          project_id: projectId || undefined,
        })
        if (run) {
          recordActiveStudioRun({
            prompt: variables.text,
            model: variables.model,
            previewUrls: run.result_url ? [run.result_url] : undefined,
            run: {
              id: run.id,
              model: run.model,
              prompt: run.prompt,
              resultUrl: run.result_url,
              assetId: run.asset_id,
              taskId: run.task_id,
              createdAt: run.created_at ? run.created_at * 1000 : Date.now(),
            },
          })
        }
        await queryClient.invalidateQueries({
          queryKey: ['playground', 'runs'],
        })
      })()
    },
  })

  return {
    settings,
    setSettings,
    images,
    video,
    audioUrl,
    imageMutation,
    videoMutation,
    audioMutation,
  }
}
