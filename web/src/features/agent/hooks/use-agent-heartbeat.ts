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
import axios from 'axios'
import { useEffect } from 'react'

import { api } from '@/lib/http-client'
import { useAuthStore } from '@/stores/auth-store'

import { parseRetryAfter } from '../api'
import {
  AgentHeartbeatRequestError,
  createAgentHeartbeatController,
  getAgentHeartbeatStorageKey,
} from '../heartbeat'

const memoryTimestamps = new Map<string, number>()

function readLastSentAt(storageKey: string): number {
  try {
    const stored = window.localStorage.getItem(storageKey)
    const value = stored ? Number(stored) : 0
    if (Number.isFinite(value) && value > 0) return value
  } catch {
    // Fall back to memory when storage is unavailable or blocked.
  }
  return memoryTimestamps.get(storageKey) ?? 0
}

function writeLastSentAt(storageKey: string, value: number): void {
  memoryTimestamps.set(storageKey, value)
  try {
    window.localStorage.setItem(storageKey, String(value))
  } catch {
    // The in-memory value still throttles this tab.
  }
}

function retryAfterFromHeaders(headers: unknown): number | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  const record = headers as Record<string, unknown> & {
    get?: (name: string) => unknown
  }
  const raw = record['retry-after'] ?? record.get?.('retry-after')
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined
  return parseRetryAfter(raw)
}

async function sendAgentHeartbeat(signal: AbortSignal): Promise<void> {
  try {
    await api.post('/agent/api/heartbeat', undefined, {
      signal,
      skipBusinessError: true,
      skipErrorHandler: true,
    })
  } catch (error) {
    if (axios.isCancel(error)) throw error
    if (!axios.isAxiosError(error)) {
      throw new AgentHeartbeatRequestError('Agent heartbeat request failed', {
        retryable: false,
        cause: error,
      })
    }

    const status = error.response?.status
    if (status === 429) {
      throw new AgentHeartbeatRequestError('Agent heartbeat rate limited', {
        retryable: true,
        retryAfterMs: retryAfterFromHeaders(error.response?.headers),
        cause: error,
      })
    }
    if (status === undefined || status >= 500) {
      throw new AgentHeartbeatRequestError('Agent heartbeat unavailable', {
        retryable: true,
        cause: error,
      })
    }
    throw new AgentHeartbeatRequestError('Agent heartbeat rejected', {
      retryable: false,
      cause: error,
    })
  }
}

export function useAgentHeartbeat(): void {
  const userId = useAuthStore((state) => state.auth.user?.id)
  const sid = useAuthStore((state) => state.auth.session?.sid)

  useEffect(() => {
    if (!userId || !sid) return

    const storageKey = getAgentHeartbeatStorageKey(userId, sid)
    const controller = createAgentHeartbeatController(storageKey, {
      now: Date.now,
      isVisible: () => document.visibilityState !== 'hidden',
      readLastSentAt,
      writeLastSentAt,
      send: sendAgentHeartbeat,
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (timer) => window.clearTimeout(timer),
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        controller.pause()
        return
      }
      void controller.resume()
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) void controller.refresh()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('storage', handleStorage)
    void controller.start()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorage)
      controller.stop()
    }
  }, [sid, userId])
}
