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
import { z } from 'zod'

import { isHttpUrl } from '@/lib/content-format'
import type { LocalizedTextValue } from '@/lib/localized-text'
import { getServerErrorSources } from '@/lib/server-error-message'

/** The callback page hands its result to the login dialog on this channel. */
export const PLUGIN_LOGIN_BROADCAST_CHANNEL = 'new-api-plugin-login'

/** RFC 8628 §3.2: clients poll every 5 seconds unless told otherwise. */
const DEFAULT_POLL_INTERVAL = 5

export type PluginLoginField = {
  name: string
  label?: LocalizedTextValue | null
  type: 'text' | 'password' | 'textarea'
  required?: boolean
  placeholder?: LocalizedTextValue | null
  description?: LocalizedTextValue | null
}

/** The non-secret summary the server shows for one credential line. */
export type PluginCredentialSummary = {
  index: number
  label?: string
  account_id?: string
  expires_at?: number
  needs_login?: boolean
}

/** One login step as the server shows it to the browser (StepView). */
export type PluginLoginStep =
  | { type: 'redirect'; url: string }
  | { type: 'paste'; url: string; hint?: LocalizedTextValue | null }
  | {
      type: 'device'
      user_code: string
      verification_uri: string
      verification_uri_complete?: string
      interval?: number
      expires_at?: number
    }
  | { type: 'pending'; interval?: number }
  | { type: 'fields'; fields: PluginLoginField[] }
  | { type: 'done'; credential?: PluginCredentialSummary }

export type PluginLoginInput =
  | { callback_url: string }
  | { fields: Record<string, string> }
  | { poll: true }

export type PluginLoginRequest =
  | { kind: 'start' }
  | { kind: 'continue'; input: PluginLoginInput }

export type PluginLoginState = {
  flow: string | null
  /** The step on screen. A pending poll keeps the device code visible. */
  step: PluginLoginStep | null
  /** Seconds between polls while the vendor has not confirmed the login. */
  interval: number
  status: 'idle' | 'busy' | 'failed'
  /** The request in flight, or the failed one that Retry sends again. */
  request: PluginLoginRequest | null
  error: unknown
  /** The server ended this flow, so only a new login can go on. */
  ended: boolean
}

export type PluginLoginEvent =
  | { type: 'request'; request: PluginLoginRequest }
  | { type: 'started'; flow: string; step: PluginLoginStep }
  | { type: 'received'; step: PluginLoginStep }
  | { type: 'failed'; error: unknown; ended?: boolean }

export const INITIAL_PLUGIN_LOGIN_STATE: PluginLoginState = {
  flow: null,
  step: null,
  interval: DEFAULT_POLL_INTERVAL,
  status: 'idle',
  request: null,
  error: null,
  ended: false,
}

function pollInterval(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, value)
    : fallback
}

function applyStep(
  state: PluginLoginState,
  step: PluginLoginStep
): PluginLoginState {
  const settled = {
    ...state,
    status: 'idle' as const,
    request: null,
    error: null,
    ended: false,
  }
  if (step.type === 'pending') {
    return {
      ...settled,
      step: isPluginLoginPolling(state.step) ? state.step : step,
      interval: pollInterval(step.interval, state.interval),
    }
  }
  return {
    ...settled,
    step,
    interval:
      step.type === 'device'
        ? pollInterval(step.interval, DEFAULT_POLL_INTERVAL)
        : state.interval,
  }
}

export function pluginLoginReducer(
  state: PluginLoginState,
  event: PluginLoginEvent
): PluginLoginState {
  switch (event.type) {
    case 'request':
      // A new flow drops whatever the previous one left on screen.
      if (event.request.kind === 'start') {
        return {
          ...INITIAL_PLUGIN_LOGIN_STATE,
          status: 'busy',
          request: event.request,
        }
      }
      return { ...state, status: 'busy', request: event.request, error: null }
    case 'started':
      return applyStep(
        { ...INITIAL_PLUGIN_LOGIN_STATE, flow: event.flow },
        event.step
      )
    case 'received':
      // A finished login ignores late poll replies and repeated callbacks.
      if (state.step?.type === 'done') return state
      return applyStep(state, event.step)
    case 'failed':
      return {
        ...state,
        status: 'failed',
        error: event.error,
        ended: event.ended ?? endsPluginLogin(event.error),
      }
  }
}

/** Steps the dialog keeps polling until the vendor confirms the login. */
export function isPluginLoginPolling(step: PluginLoginStep | null): boolean {
  return step?.type === 'device' || step?.type === 'pending'
}

const STEP_TYPES = new Set<string>([
  'redirect',
  'paste',
  'device',
  'pending',
  'fields',
  'done',
])

/**
 * Reads a callback page message for one channel. BroadcastChannel only
 * delivers same-origin messages, so the check covers shape and channel only.
 */
export function readPluginLoginMessage(
  data: unknown,
  channelId: number
): PluginLoginStep | null {
  if (!data || typeof data !== 'object') return null
  const message = data as { channel_id?: unknown; step?: unknown }
  if (message.channel_id !== channelId) return null
  const step = message.step as { type?: unknown } | null | undefined
  if (!step || typeof step !== 'object' || typeof step.type !== 'string') {
    return null
  }
  return STEP_TYPES.has(step.type) ? (step as PluginLoginStep) : null
}

/**
 * Reads a failure the callback page reports. The page knows only the `state`
 * the vendor sent back, which is the flow token.
 */
export function readPluginLoginFailure(
  data: unknown,
  flow: string | null
): string | null {
  if (!flow || !data || typeof data !== 'object') return null
  const message = data as { state?: unknown; error?: unknown }
  if (message.state !== flow || typeof message.error !== 'string') return null
  return message.error
}

/**
 * Server answers that end a login: the flow is gone, or the server used it up
 * before rejecting the credential the plugin returned. Sending the same
 * request again cannot work, so the dialog offers a new login instead.
 */
const LOGIN_ENDING_MESSAGES = new Set([
  'Login flow is invalid or has expired',
  'The device code has expired',
  'Credential index out of range',
  'Logged in to a different account than the credential being replaced',
  'This account is already logged in on another credential of this plugin',
  "This channel's key cannot hold another account",
  "This channel's key format cannot hold plugin credentials",
  "This channel's plugin does not support login",
])

export function endsPluginLogin(error: unknown): boolean {
  return getServerErrorSources(error).some(
    (source) =>
      typeof source.message_key === 'string' &&
      LOGIN_ENDING_MESSAGES.has(source.message_key)
  )
}

/**
 * The address the vendor sends the browser to after sign-in, read from the
 * standard OAuth `redirect_uri` parameter of the sign-in page address.
 */
export function readPluginLoginRedirect(url: string): string | null {
  let redirect: string | null
  try {
    redirect = new URL(url).searchParams.get('redirect_uri')
  } catch {
    return null
  }
  return redirect && isHttpUrl(redirect) ? redirect : null
}

/** The paste step takes the whole address-bar URL; the server parses it. */
export const pluginLoginPasteSchema = z.object({
  callback_url: z
    .string()
    .refine(
      (value) => value.trim() !== '',
      'Paste the full address from the address bar'
    ),
})

export function pluginLoginFieldsSchema(fields: PluginLoginField[]) {
  return z.object(
    Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.required
          ? z
              .string()
              .refine((value) => value.trim() !== '', 'This field is required')
          : z.string(),
      ])
    )
  )
}
