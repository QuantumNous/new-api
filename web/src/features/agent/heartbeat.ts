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
export const AGENT_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1_000
export const AGENT_HEARTBEAT_RETRY_MS = 30 * 1_000

type AgentHeartbeatRequestErrorOptions = {
  retryable: boolean
  retryAfterMs?: number
  cause?: unknown
}

export class AgentHeartbeatRequestError extends Error {
  readonly retryable: boolean
  readonly retryAfterMs?: number

  constructor(message: string, options: AgentHeartbeatRequestErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'AgentHeartbeatRequestError'
    this.retryable = options.retryable
    this.retryAfterMs = options.retryAfterMs
  }
}

export type AgentHeartbeatRuntime<Timer> = {
  now: () => number
  isVisible: () => boolean
  readLastSentAt: (storageKey: string) => number
  writeLastSentAt: (storageKey: string, value: number) => void
  send: (signal: AbortSignal) => Promise<void>
  schedule: (callback: () => void, delay: number) => Timer
  cancel: (timer: Timer) => void
  random?: () => number
}

export type AgentHeartbeatController = {
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  refresh: () => Promise<void>
  stop: () => void
}

export function getAgentHeartbeatStorageKey(
  userId: number,
  sid: string
): string {
  let hash = 2166136261
  for (let index = 0; index < sid.length; index += 1) {
    hash ^= sid.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `chimera.agent-heartbeat.v1:${userId}:${(hash >>> 0).toString(36)}`
}

export function createAgentHeartbeatController<Timer>(
  storageKey: string,
  runtime: AgentHeartbeatRuntime<Timer>,
  intervalMs = AGENT_HEARTBEAT_INTERVAL_MS,
  retryMs = AGENT_HEARTBEAT_RETRY_MS
): AgentHeartbeatController {
  const abortController = new AbortController()
  let timer: Timer | undefined
  let busy = false
  let stopped = false
  let consecutiveFailures = 0

  const clearTimer = () => {
    if (timer === undefined) return
    runtime.cancel(timer)
    timer = undefined
  }

  const scheduleNext = (delay: number) => {
    clearTimer()
    if (stopped) return
    timer = runtime.schedule(
      () => {
        timer = undefined
        void run()
      },
      Math.max(0, delay)
    )
  }

  const run = async (): Promise<void> => {
    if (stopped || busy) return
    clearTimer()
    if (!runtime.isVisible()) return

    const now = runtime.now()
    const lastSentAt = runtime.readLastSentAt(storageKey)
    const remaining = lastSentAt + intervalMs - now
    if (lastSentAt > 0 && remaining > 0) {
      scheduleNext(remaining)
      return
    }

    runtime.writeLastSentAt(storageKey, now)
    busy = true
    try {
      await runtime.send(abortController.signal)
      consecutiveFailures = 0
      if (!stopped) scheduleNext(intervalMs)
    } catch (error) {
      if (!stopped) {
        const requestError =
          error instanceof AgentHeartbeatRequestError ? error : undefined
        consecutiveFailures += 1
        const exponentialDelay = Math.min(
          retryMs * 2 ** (consecutiveFailures - 1),
          intervalMs
        )
        const random = runtime.random?.() ?? Math.random()
        const jitteredDelay = Math.round(
          exponentialDelay * (0.8 + Math.min(1, Math.max(0, random)) * 0.4)
        )
        let delay = jitteredDelay
        if (requestError?.retryable === false) {
          delay = intervalMs
        } else if (requestError?.retryAfterMs !== undefined) {
          delay = Math.max(retryMs, requestError.retryAfterMs)
        }
        runtime.writeLastSentAt(storageKey, runtime.now() - intervalMs + delay)
        scheduleNext(delay)
      }
    } finally {
      busy = false
    }
  }

  return {
    start: run,
    pause: clearTimer,
    resume: run,
    refresh: run,
    stop: () => {
      stopped = true
      clearTimer()
      abortController.abort()
    },
  }
}
