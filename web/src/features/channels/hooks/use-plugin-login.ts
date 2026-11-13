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
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
} from 'react'

import { continuePluginLogin, startPluginLogin } from '../api'
import {
  INITIAL_PLUGIN_LOGIN_STATE,
  PLUGIN_LOGIN_BROADCAST_CHANNEL,
  isPluginLoginPolling,
  pluginLoginReducer,
  readPluginLoginFailure,
  readPluginLoginMessage,
  type PluginLoginInput,
  type PluginLoginRequest,
} from '../lib/plugin-login'

type UsePluginLoginOptions = {
  channelId: number
  keyIndex: number | null
  add?: boolean
  onDone?: () => void
}

/**
 * Drives one login flow from the first step to `done`. Every step result comes
 * from the server; the browser only collects input and polls on the server's
 * interval.
 */
export function usePluginLogin(options: UsePluginLoginOptions) {
  const [state, dispatch] = useReducer(
    pluginLoginReducer,
    INITIAL_PLUGIN_LOGIN_STATE
  )
  const channelId = options.channelId
  const keyIndex = options.keyIndex
  const add = options.add ?? false
  const alive = useRef(true)
  const generation = useRef(0)
  const started = useRef(false)
  const notifyDone = useEffectEvent(() => options.onDone?.())

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const send = useCallback(
    async (request: PluginLoginRequest, flow: string | null) => {
      const current = generation.current
      const stale = () => !alive.current || current !== generation.current
      dispatch({ type: 'request', request })
      try {
        if (request.kind === 'start') {
          const result = await startPluginLogin(channelId, keyIndex, add)
          if (!stale()) {
            dispatch({ type: 'started', flow: result.flow, step: result.step })
          }
          return
        }
        const step = await continuePluginLogin(
          channelId,
          flow ?? '',
          request.input
        )
        if (!stale()) dispatch({ type: 'received', step })
      } catch (error) {
        if (!stale()) dispatch({ type: 'failed', error })
      }
    },
    [channelId, keyIndex, add]
  )

  // Refs survive StrictMode's simulated remount, so one dialog opens one flow.
  useEffect(() => {
    if (started.current) return
    started.current = true
    void send({ kind: 'start' }, null)
  }, [send])

  // The deadline follows the clock rather than counting ticks, because the
  // vendor page sits in another tab and browsers throttle timers in this one.
  const step = state.step
  const deviceExpiresAt =
    step?.type === 'device' && step.expires_at ? step.expires_at : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deviceExpiresAt === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [deviceExpiresAt])
  const secondsLeft =
    deviceExpiresAt === null
      ? null
      : Math.max(0, Math.ceil(deviceExpiresAt - now / 1000))
  const expired = secondsLeft === 0

  const polling =
    state.status === 'idle' && isPluginLoginPolling(step) && !expired
  const flow = state.flow
  const interval = state.interval
  useEffect(() => {
    if (!polling) return
    const timer = window.setTimeout(() => {
      void send({ kind: 'continue', input: { poll: true } }, flow)
    }, interval * 1000)
    return () => window.clearTimeout(timer)
  }, [polling, interval, flow, step, send])

  // The callback page in the other tab reports the vendor redirect here.
  const awaitingCallback = step?.type === 'redirect'
  useEffect(() => {
    if (!awaitingCallback || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(PLUGIN_LOGIN_BROADCAST_CHANNEL)
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!alive.current) return
      const next = readPluginLoginMessage(event.data, channelId)
      if (next) {
        dispatch({ type: 'received', step: next })
        return
      }
      // The server rejected this flow's callback, which ends the flow.
      const error = readPluginLoginFailure(event.data, flow)
      if (error !== null) dispatch({ type: 'failed', error, ended: true })
    })
    return () => channel.close()
  }, [awaitingCallback, channelId, flow])

  const done = step?.type === 'done'
  useEffect(() => {
    if (done) notifyDone()
  }, [done])

  return {
    state,
    secondsLeft,
    expired,
    submit: (input: PluginLoginInput) =>
      void send({ kind: 'continue', input }, flow),
    retry: () => {
      if (state.request) void send(state.request, flow)
    },
    restart: () => {
      generation.current += 1
      void send({ kind: 'start' }, null)
    },
  }
}
