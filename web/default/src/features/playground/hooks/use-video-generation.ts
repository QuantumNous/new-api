/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useRef, useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { submitVideo, fetchVideoStatus, fetchVideoContent } from '../api'
import {
  MESSAGE_ROLES,
  MESSAGE_STATUS,
  VIDEO_POLL_INTERVAL_MS,
} from '../constants'
import type { Message, VideoTask } from '../types'

interface UseVideoGenerationOptions {
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
}

const clampProgress = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Extract a human-readable error string from a task error field or an
 * axios/thrown error, without leaking `[object Object]`.
 */
function readableError(input: unknown): string {
  if (!input) return ''
  if (typeof input === 'string') return input
  if (typeof input === 'object') {
    const obj = input as {
      message?: string
      response?: { data?: { message?: string; error?: { message?: string } } }
    }
    return (
      obj.response?.data?.error?.message ||
      obj.response?.data?.message ||
      obj.message ||
      ''
    )
  }
  return ''
}

/**
 * Hook for the async video-generation flow (veo models). Submits a `/v1/videos`
 * task, polls its status ~every 6s, then downloads the finished MP4 as a blob and
 * hands back an object URL for inline `<video>` playback. Object URLs are tracked
 * and revoked on unmount (and can be released per-message on delete) to avoid
 * leaks. A cancel flag stops polling and finalizes the in-flight message.
 */
export function useVideoGeneration({
  onMessageUpdate,
}: UseVideoGenerationOptions) {
  const [isGenerating, setIsGenerating] = useState(false)
  const cancelledRef = useRef(false)
  const isMountedRef = useRef(true)
  // Every object URL we create, so unmount can revoke them all.
  const objectUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    isMountedRef.current = true
    // The Set instance is stable across renders; capture it so the cleanup
    // revokes exactly the URLs this hook created (react-hooks/exhaustive-deps).
    const objectUrls = objectUrlsRef.current
    return () => {
      isMountedRef.current = false
      cancelledRef.current = true
      for (const url of objectUrls) URL.revokeObjectURL(url)
      objectUrls.clear()
    }
  }, [])

  const patchMessage = useCallback(
    (key: string, patch: Partial<Message>) => {
      onMessageUpdate((prev) =>
        prev.map((m) => (m.key === key ? { ...m, ...patch } : m))
      )
    },
    [onMessageUpdate]
  )

  const failVideo = useCallback(
    (key: string, detail?: string) => {
      const base = i18next.t('Video generation failed')
      const text = detail ? `${base}: ${detail}` : base
      toast.error(text)
      onMessageUpdate((prev) =>
        prev.map((m) =>
          m.key === key
            ? {
                ...m,
                status: MESSAGE_STATUS.ERROR,
                videoProgress: undefined,
                versions: [
                  { ...(m.versions[0] ?? { id: 'error' }), content: text },
                ],
              }
            : m
        )
      )
    },
    [onMessageUpdate]
  )

  const stopped = useCallback(
    () => cancelledRef.current || !isMountedRef.current,
    []
  )

  const generateVideo = useCallback(
    async (prompt: string, model: string, key: string) => {
      cancelledRef.current = false
      setIsGenerating(true)
      try {
        let task: VideoTask = await submitVideo(model, prompt)
        if (stopped()) return
        if (!task?.id) throw new Error('Missing task id')

        // Poll loop: update progress, wait, refetch — until completed/failed.
        // Using awaited setTimeout (not setInterval) avoids overlapping polls.
        while (true) {
          if (stopped()) return

          if (task.status === 'completed') {
            const blob = await fetchVideoContent(task.id)
            if (stopped()) return
            const url = URL.createObjectURL(blob)
            objectUrlsRef.current.add(url)
            patchMessage(key, {
              status: MESSAGE_STATUS.COMPLETE,
              videoProgress: 100,
              videoUrl: url,
            })
            return
          }

          if (task.status === 'failed') {
            failVideo(key, readableError(task.error))
            return
          }

          patchMessage(key, {
            status: MESSAGE_STATUS.STREAMING,
            videoProgress: clampProgress(task.progress),
          })

          await delay(VIDEO_POLL_INTERVAL_MS)
          if (stopped()) return
          task = await fetchVideoStatus(task.id)
        }
      } catch (err) {
        if (stopped()) return
        failVideo(key, readableError(err))
      } finally {
        if (isMountedRef.current) setIsGenerating(false)
      }
    },
    [patchMessage, failVideo, stopped]
  )

  // Cancel the in-flight generation: stop polling and finalize the last
  // still-generating video message as an error so the UI doesn't hang.
  const stopVideoGeneration = useCallback(() => {
    cancelledRef.current = true
    setIsGenerating(false)
    onMessageUpdate((prev) => {
      let idx = -1
      for (let i = prev.length - 1; i >= 0; i--) {
        const m = prev[i]
        if (
          m.from === MESSAGE_ROLES.ASSISTANT &&
          m.isVideo &&
          (m.status === MESSAGE_STATUS.LOADING ||
            m.status === MESSAGE_STATUS.STREAMING)
        ) {
          idx = i
          break
        }
      }
      if (idx === -1) return prev
      const next = [...prev]
      const m = next[idx]
      next[idx] = {
        ...m,
        status: MESSAGE_STATUS.ERROR,
        videoProgress: undefined,
        versions: [
          {
            ...(m.versions[0] ?? { id: 'error' }),
            content: i18next.t('Video generation failed'),
          },
        ],
      }
      return next
    })
  }, [onMessageUpdate])

  // Revoke a single video's object URL (call when its message is deleted).
  const releaseVideoObjectUrl = useCallback((url?: string) => {
    if (!url) return
    if (objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url)
      objectUrlsRef.current.delete(url)
    }
  }, [])

  return {
    generateVideo,
    stopVideoGeneration,
    releaseVideoObjectUrl,
    isVideoGenerating: isGenerating,
  }
}
