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
import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import { createServerError } from '@/lib/server-error-message'

import {
  INITIAL_PLUGIN_LOGIN_STATE,
  pluginLoginFieldsSchema,
  pluginLoginPasteSchema,
  pluginLoginReducer,
  readPluginLoginFailure,
  readPluginLoginMessage,
  readPluginLoginRedirect,
  type PluginLoginEvent,
  type PluginLoginState,
  type PluginLoginStep,
} from '../plugin-login'

const device: PluginLoginStep = {
  type: 'device',
  user_code: 'ABCD-EFGH',
  verification_uri: 'https://vendor.example/device',
  interval: 7,
  expires_at: 1_900_000_000,
}

function run(...events: PluginLoginEvent[]): PluginLoginState {
  return events.reduce(pluginLoginReducer, INITIAL_PLUGIN_LOGIN_STATE)
}

describe('pluginLoginReducer', () => {
  test('a started flow shows its first step and polls on its interval', () => {
    const state = run(
      { type: 'request', request: { kind: 'start' } },
      { type: 'started', flow: 'flow-1', step: device }
    )
    assert.equal(state.flow, 'flow-1')
    assert.deepEqual(state.step, device)
    assert.equal(state.interval, 7)
    assert.equal(state.status, 'idle')
    assert.equal(state.request, null)
  })

  test('a pending poll keeps the device code on screen and takes the new interval', () => {
    const state = run(
      { type: 'started', flow: 'flow-1', step: device },
      { type: 'received', step: { type: 'pending', interval: 12 } }
    )
    assert.deepEqual(state.step, device)
    assert.equal(state.interval, 12)
  })

  test('a pending step without a code on screen is shown as is', () => {
    const state = run(
      { type: 'started', flow: 'flow-1', step: { type: 'pending' } },
      { type: 'received', step: { type: 'pending' } }
    )
    assert.deepEqual(state.step, { type: 'pending' })
    assert.equal(state.interval, 5)
  })

  test('unusable intervals fall back and short ones wait at least a second', () => {
    for (const interval of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = run({
        type: 'started',
        flow: 'flow-1',
        step: { ...device, interval },
      })
      assert.equal(state.interval, 5)
    }
    const fast = run({
      type: 'started',
      flow: 'flow-1',
      step: { ...device, interval: 0.2 },
    })
    assert.equal(fast.interval, 1)
  })

  test('a finished login ignores late replies', () => {
    const done: PluginLoginStep = {
      type: 'done',
      credential: { index: 0, label: 'user@example.com' },
    }
    const state = run(
      { type: 'started', flow: 'flow-1', step: device },
      { type: 'received', step: done },
      { type: 'received', step: { type: 'pending' } },
      { type: 'received', step: device }
    )
    assert.deepEqual(state.step, done)
  })

  test('a failure keeps the request for retry and the step on screen', () => {
    const request = {
      kind: 'continue' as const,
      input: { callback_url: 'https://app.example/cb?code=1' },
    }
    const paste: PluginLoginStep = {
      type: 'paste',
      url: 'https://vendor.example/authorize',
    }
    const error = new Error('vendor said no')
    const failed = run(
      { type: 'started', flow: 'flow-1', step: paste },
      { type: 'request', request },
      { type: 'failed', error }
    )
    assert.equal(failed.status, 'failed')
    assert.deepEqual(failed.request, request)
    assert.equal(failed.error, error)
    assert.deepEqual(failed.step, paste)

    const retried = pluginLoginReducer(failed, { type: 'request', request })
    assert.equal(retried.status, 'busy')
    assert.equal(retried.error, null)
  })

  test('a rejected credential ends the flow and a new login clears it', () => {
    const paste: PluginLoginStep = {
      type: 'paste',
      url: 'https://vendor.example/authorize',
    }
    const request = {
      kind: 'continue' as const,
      input: { callback_url: 'https://app.example/cb?code=1' },
    }
    const rejected =
      'Logged in to a different account than the credential being replaced'
    const ended = run(
      { type: 'started', flow: 'flow-1', step: paste },
      { type: 'request', request },
      {
        type: 'failed',
        error: createServerError({
          success: false,
          message: rejected,
          message_key: rejected,
        }),
      }
    )
    assert.equal(ended.status, 'failed')
    assert.equal(ended.ended, true)

    // A plugin that throws leaves the step open, so Retry can send it again.
    const thrown = run(
      { type: 'started', flow: 'flow-1', step: paste },
      { type: 'request', request },
      {
        type: 'failed',
        error: createServerError({
          success: false,
          message: 'Plugin login failed: timeout',
          message_key: 'Plugin login failed: {{error}}',
          message_params: { error: 'timeout' },
        }),
      }
    )
    assert.equal(thrown.ended, false)

    const restarted = pluginLoginReducer(ended, {
      type: 'request',
      request: { kind: 'start' },
    })
    assert.deepEqual(restarted, {
      ...INITIAL_PLUGIN_LOGIN_STATE,
      status: 'busy',
      request: { kind: 'start' },
    })
  })

  test('a rejected callback ends the flow until a step arrives', () => {
    const failed = run(
      {
        type: 'started',
        flow: 'flow-1',
        step: { type: 'redirect', url: 'https://vendor.example/authorize' },
      },
      {
        type: 'failed',
        error: 'The callback issuer does not match',
        ended: true,
      }
    )
    assert.equal(failed.ended, true)

    const done = pluginLoginReducer(failed, {
      type: 'received',
      step: { type: 'done', credential: { index: 0 } },
    })
    assert.equal(done.ended, false)
    assert.equal(done.status, 'idle')
  })

  test('starting again drops the previous flow', () => {
    const state = run(
      { type: 'started', flow: 'flow-1', step: { ...device, interval: 9 } },
      { type: 'request', request: { kind: 'start' } },
      {
        type: 'started',
        flow: 'flow-2',
        step: { type: 'redirect', url: 'https://vendor.example/authorize' },
      }
    )
    assert.equal(state.flow, 'flow-2')
    assert.equal(state.interval, 5)
    assert.equal(state.step?.type, 'redirect')
  })
})

describe('readPluginLoginMessage', () => {
  const done = { type: 'done', credential: { index: 1 } }

  test('accepts a step for the same channel', () => {
    assert.deepEqual(
      readPluginLoginMessage({ channel_id: 7, step: done }, 7),
      done
    )
  })

  test('ignores other channels and malformed messages', () => {
    assert.equal(readPluginLoginMessage({ channel_id: 8, step: done }, 7), null)
    assert.equal(
      readPluginLoginMessage({ channel_id: '7', step: done }, 7),
      null
    )
    assert.equal(
      readPluginLoginMessage({ channel_id: 7, step: { type: 'script' } }, 7),
      null
    )
    assert.equal(readPluginLoginMessage({ channel_id: 7 }, 7), null)
    assert.equal(readPluginLoginMessage('done', 7), null)
    assert.equal(readPluginLoginMessage(null, 7), null)
  })
})

describe('readPluginLoginFailure', () => {
  test('accepts a failure for the same flow only', () => {
    const failure = { state: 'flow-1', error: 'Login failed' }
    assert.equal(readPluginLoginFailure(failure, 'flow-1'), 'Login failed')
    assert.equal(readPluginLoginFailure(failure, 'flow-2'), null)
    assert.equal(readPluginLoginFailure(failure, null), null)
    assert.equal(readPluginLoginFailure({ state: 'flow-1' }, 'flow-1'), null)
    assert.equal(
      readPluginLoginFailure(
        { channel_id: 7, step: { type: 'done' } },
        'flow-1'
      ),
      null
    )
    assert.equal(readPluginLoginFailure('flow-1', 'flow-1'), null)
  })
})

describe('readPluginLoginRedirect', () => {
  test('reads the redirect address from the sign-in page address', () => {
    assert.equal(
      readPluginLoginRedirect(
        'https://auth.vendor.example/oauth/authorize?client_id=c&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&state=s'
      ),
      'http://localhost:1455/auth/callback'
    )
  })

  test('gives nothing when the redirect is missing or not a web address', () => {
    for (const url of [
      'https://vendor.example/authorize?state=s',
      'https://vendor.example/authorize?redirect_uri=com.vendor.app%3A%2Fcallback',
      'https://vendor.example/authorize?redirect_uri=',
      'not a url',
    ]) {
      assert.equal(readPluginLoginRedirect(url), null, url)
    }
  })
})

describe('login form schemas', () => {
  test('the paste step needs a non-blank address', () => {
    assert.equal(
      pluginLoginPasteSchema.safeParse({ callback_url: '  ' }).success,
      false
    )
    assert.equal(
      pluginLoginPasteSchema.safeParse({
        callback_url: 'http://127.0.0.1:8000/callback?code=1',
      }).success,
      true
    )
  })

  test('required fields reject blank values and optional ones accept them', () => {
    const schema = pluginLoginFieldsSchema([
      { name: 'token', type: 'password', required: true },
      { name: 'note', type: 'text' },
    ])
    assert.equal(schema.safeParse({ token: ' ', note: '' }).success, false)
    assert.equal(schema.safeParse({ token: 'secret', note: '' }).success, true)
  })
})
