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
import { afterEach, describe, test } from 'node:test'
import {
  ensureMixpanelLoaded,
  getMixpanelConsentStatus,
  grantMixpanelConsent,
  identifyMixpanelUser,
  shouldEnableMixpanel,
} from './mixpanel'

const originalWindow = globalThis.window
const originalDocument = globalThis.document

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  })
})

describe('mixpanel consent gate', () => {
  test('does not enable tracking before explicit consent', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => null,
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: '',
        createElement: () => ({}),
        head: { appendChild: () => undefined },
      },
    })

    assert.equal(getMixpanelConsentStatus(), 'unknown')
    assert.equal(shouldEnableMixpanel(), false)
  })

  test('enables tracking after local consent is granted', () => {
    let saved = ''
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => saved,
          setItem: (_key: string, value: string) => {
            saved = value
          },
        },
        location: { protocol: 'https:' },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: '',
        createElement: () => ({}),
        head: { appendChild: () => undefined },
      },
    })

    grantMixpanelConsent()

    assert.equal(getMixpanelConsentStatus(), 'granted')
    assert.equal(shouldEnableMixpanel(), true)
  })

  test('initializes Mixpanel with autocapture and session recording after consent', async () => {
    let saved = 'granted'
    let initConfig: Record<string, string | number | boolean | undefined> = {}
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => saved,
          setItem: (_key: string, value: string) => {
            saved = value
          },
        },
        location: { protocol: 'https:' },
        mixpanel: {
          init: (
            _token: string,
            config?: Record<string, string | number | boolean | undefined>
          ) => {
            initConfig = config ?? {}
          },
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: '',
      },
    })

    assert.equal(await ensureMixpanelLoaded(), true)
    assert.equal(initConfig.autocapture, true)
    assert.equal(initConfig.record_sessions_percent, 100)
  })

  test('sets the user email on the Mixpanel profile after consent', async () => {
    let saved = 'granted'
    let peopleProperties: Record<
      string,
      string | number | boolean | undefined
    > = {}

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: () => saved,
          setItem: (_key: string, value: string) => {
            saved = value
          },
        },
        location: { protocol: 'https:' },
        mixpanel: {
          init: () => undefined,
          identify: () => undefined,
          people: {
            set: (
              properties: Record<
                string,
                string | number | boolean | undefined
              >
            ) => {
              peopleProperties = properties
            },
          },
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: '',
      },
    })

    identifyMixpanelUser({
      id: 42,
      username: 'alice',
      email: 'alice@example.com',
      role: 1,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(peopleProperties.$email, 'alice@example.com')
    assert.equal(peopleProperties.email, 'alice@example.com')
  })
})
