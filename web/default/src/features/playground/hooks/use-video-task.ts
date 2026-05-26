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
import { toast } from 'sonner'
import {
  submitVideoGeneration,
  fetchVideoTaskStatus,
  fetchTokenKey,
} from '../api'
import { VIDEO_POLLING_INTERVAL, STORAGE_KEYS_VIDEO } from '../constants'
import type { VideoGenerationRequest, VideoTaskItem, VideoModelType } from '../types'

function loadTasksFromStorage(): VideoTaskItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS_VIDEO.TASK_QUEUE)
    if (!raw) return []
    return JSON.parse(raw) as VideoTaskItem[]
  } catch {
    return []
  }
}

function saveTasksToStorage(tasks: VideoTaskItem[]) {
  try {
    localStorage.setItem(STORAGE_KEYS_VIDEO.TASK_QUEUE, JSON.stringify(tasks))
  } catch {
    // ignore storage errors
  }
}

export function useVideoTask() {
  const [tasks, setTasks] = useState<VideoTaskItem[]>(() =>
    loadTasksFromStorage()
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const pollingTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  // Store apiKey per task for polling
  const taskApiKeys = useRef<Record<string, string>>({})

  // Persist tasks whenever they change
  useEffect(() => {
    saveTasksToStorage(tasks)
  }, [tasks])

  const updateTask = useCallback((id: string, patch: Partial<VideoTaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    )
  }, [])

  const stopPolling = useCallback((id: string) => {
    const timer = pollingTimers.current[id]
    if (timer) {
      clearInterval(timer)
      delete pollingTimers.current[id]
    }
  }, [])

  const startPolling = useCallback(
    (id: string, apiKey: string) => {
      // Avoid duplicate intervals
      if (pollingTimers.current[id]) return

      const poll = async () => {
        try {
          const res = await fetchVideoTaskStatus(id, apiKey)
          const status = res.status
          const videoUrl =
            status === 'completed'
              ? (res.metadata?.url as string | undefined)
              : undefined
          const errorMsg =
            status === 'failed' ? (res.error?.message ?? 'Generation failed') : undefined

          updateTask(id, {
            status,
            progress: res.progress ?? 0,
            ...(videoUrl ? { videoUrl } : {}),
            ...(res.completed_at ? { completedAt: res.completed_at } : {}),
            ...(errorMsg ? { error: errorMsg } : {}),
          })

          if (status === 'completed' || status === 'failed') {
            stopPolling(id)
            if (status === 'completed') {
              toast.success('Video generation completed')
            } else {
              toast.error(errorMsg ?? 'Video generation failed')
            }
          }
        } catch {
          // polling errors are transient; keep retrying
        }
      }

      // First poll immediately, then repeat
      void poll()
      pollingTimers.current[id] = setInterval(poll, VIDEO_POLLING_INTERVAL)
    },
    [updateTask, stopPolling]
  )

  // On mount, resume polling for any unfinished tasks that have a tokenId
  useEffect(() => {
    const resumePolling = async () => {
      const stored = loadTasksFromStorage()
      const pending = stored.filter(
        (t) =>
          (t.status === 'queued' || t.status === 'in_progress') && t.tokenId
      )
      for (const task of pending) {
        try {
          const realKey = await fetchTokenKey(task.tokenId!)
          if (realKey) {
            taskApiKeys.current[task.id] = realKey
            startPolling(task.id, realKey)
          } else {
            updateTask(task.id, {
              status: 'failed',
              error: 'API Key no longer valid',
            })
            toast.error(`Task "${task.prompt.slice(0, 30)}..." failed: API Key invalid`)
          }
        } catch {
          updateTask(task.id, {
            status: 'failed',
            error: 'Failed to restore API Key',
          })
          toast.error(`Task "${task.prompt.slice(0, 30)}..." failed: cannot restore key`)
        }
      }
    }
    void resumePolling()

    return () => {
      // Clear all timers on unmount
      Object.values(pollingTimers.current).forEach(clearInterval)
      pollingTimers.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitTask = useCallback(
    async (
      req: VideoGenerationRequest,
      apiKey: string,
      tokenId: number,
      meta?: { size?: string; duration?: number; type?: VideoModelType }
    ) => {
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const res = await submitVideoGeneration(req, apiKey)
        const taskId = res.id ?? res.task_id
        if (!taskId) {
          const errMsg = res.error?.message ?? 'No task ID returned from server'
          throw new Error(errMsg)
        }
        taskApiKeys.current[taskId] = apiKey
        const newTask: VideoTaskItem = {
          id: taskId,
          model: req.model,
          prompt: req.prompt,
          status: res.status ?? 'queued',
          progress: res.progress ?? 0,
          createdAt: res.created_at ?? Math.floor(Date.now() / 1000),
          tokenId,
          ...(meta?.size ? { size: meta.size } : {}),
          ...(meta?.duration != null ? { duration: meta.duration } : {}),
          ...(meta?.type ? { type: meta.type } : {}),
        }
        setTasks((prev) => [newTask, ...prev])
        startPolling(taskId, apiKey)
        return newTask
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Submission failed'
        setSubmitError(msg)
        throw err
      } finally {
        setIsSubmitting(false)
      }
    },
    [startPolling]
  )

  const clearFinishedTasks = useCallback(() => {
    setTasks((prev) =>
      prev.filter((t) => t.status === 'queued' || t.status === 'in_progress')
    )
  }, [])

  const removeTask = useCallback(
    (id: string) => {
      stopPolling(id)
      delete taskApiKeys.current[id]
      setTasks((prev) => prev.filter((t) => t.id !== id))
    },
    [stopPolling]
  )

  return {
    tasks,
    isSubmitting,
    submitError,
    submitTask,
    clearFinishedTasks,
    removeTask,
  }
}
