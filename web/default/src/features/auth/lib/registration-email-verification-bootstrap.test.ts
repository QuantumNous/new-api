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
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

type BootstrapWindow = {
  location: {
    pathname: string
    search: string
    hash: string
  }
  history: {
    state: unknown
    replaceState: (state: unknown, title: string, url: string) => void
  }
  __consumeRegistrationEmailVerificationToken?: () => string | null
  __registrationEmailVerificationRequest?: Promise<unknown>
  setTimeout?: (callback: () => void, delay: number) => number
  fetch: (
    input: string,
    init: {
      body?: string
      credentials?: string
      headers?: unknown
      method?: string
    }
  ) => Promise<{
    json: () => Promise<unknown>
    ok: boolean
    status: number
  }>
}

const indexHtml = readFileSync(
  new URL('../../../../index.html', import.meta.url),
  'utf8'
)
const routeTreeSource = readFileSync(
  new URL('../../../routeTree.gen.ts', import.meta.url),
  'utf8'
)

function getBootstrapScript(): string {
  const match = indexHtml.match(
    /<script data-registration-email-verification-bootstrap>([\s\S]*?)<\/script>/
  )
  expect(match).not.toBeNull()
  return match?.[1] || ''
}

describe('registration email verification bootstrap', () => {
  test('runs before every analytics injection point', () => {
    const bootstrapIndex = indexHtml.indexOf(
      '<script data-registration-email-verification-bootstrap>'
    )

    expect(bootstrapIndex).toBeGreaterThan(-1)
    expect(bootstrapIndex).toBeLessThan(indexHtml.indexOf('<!--umami-->'))
    expect(bootstrapIndex).toBeLessThan(
      indexHtml.indexOf('<!--Google Analytics-->')
    )
    expect(bootstrapIndex).toBeLessThan(
      indexHtml.indexOf('<!-- Google Tag Manager -->')
    )
  })

  test('scrubs the credential fragment and starts exchange before third-party scripts', async () => {
    let replacedUrl = ''
    const requests: Array<{ input: string; body?: string; method?: string }> =
      []
    const exchangeResponse = {
      success: true,
      message: '',
      data: { verified: true },
    }
    const window: BootstrapWindow = {
      location: {
        pathname: '/sign-up/verify',
        search: '?lng=en',
        hash: '#token=a%2Fb',
      },
      history: {
        state: { preserved: true },
        replaceState: (_state, _title, url) => {
          replacedUrl = url
        },
      },
      fetch: async (input, init) => {
        requests.push({ input, body: init.body, method: init.method })
        return {
          json: async () => exchangeResponse,
          ok: true,
          status: 200,
        }
      },
    }

    runInNewContext(getBootstrapScript(), {
      JSON,
      Promise,
      URLSearchParams,
      window,
    })

    expect(replacedUrl).toBe('/sign-up/verify?lng=en')
    expect(window.__consumeRegistrationEmailVerificationToken).toBeUndefined()
    expect(requests).toEqual([
      {
        input: '/api/registration/email-verification/exchange',
        body: JSON.stringify({ token: 'a/b' }),
        method: 'POST',
      },
    ])
    expect(await window.__registrationEmailVerificationRequest).toEqual(
      exchangeResponse
    )
  })

  test('retries transient network failures without re-exposing the token', async () => {
    let attempts = 0
    const exchangeResponse = {
      success: true,
      message: '',
      data: { verified: true },
    }
    const window: BootstrapWindow = {
      location: {
        pathname: '/sign-up/verify',
        search: '',
        hash: '#token=retry-token',
      },
      history: {
        state: null,
        replaceState: () => {},
      },
      setTimeout: (callback) => {
        callback()
        return 0
      },
      fetch: async () => {
        attempts += 1
        if (attempts < 3) {
          throw new Error('temporary network failure')
        }
        return {
          json: async () => exchangeResponse,
          ok: true,
          status: 200,
        }
      },
    }

    runInNewContext(getBootstrapScript(), {
      JSON,
      Promise,
      URLSearchParams,
      window,
    })

    expect(await window.__registrationEmailVerificationRequest).toEqual(
      exchangeResponse
    )
    expect(attempts).toBe(3)
    expect(window.__consumeRegistrationEmailVerificationToken).toBeUndefined()
  })

  test('keeps retries on the fetch implementation captured before analytics load', async () => {
    let trustedAttempts = 0
    let instrumentedAttempts = 0
    const exchangeResponse = {
      success: true,
      message: '',
      data: { verified: true },
    }
    const window: BootstrapWindow = {
      location: {
        pathname: '/sign-up/verify',
        search: '',
        hash: '#token=private-retry-token',
      },
      history: {
        state: null,
        replaceState: () => {},
      },
      setTimeout: (callback) => {
        window.fetch = async () => {
          instrumentedAttempts += 1
          return {
            json: async () => exchangeResponse,
            ok: true,
            status: 200,
          }
        }
        callback()
        return 0
      },
      fetch: async () => {
        trustedAttempts += 1
        if (trustedAttempts === 1) {
          throw new Error('temporary network failure')
        }
        return {
          json: async () => exchangeResponse,
          ok: true,
          status: 200,
        }
      },
    }

    runInNewContext(getBootstrapScript(), {
      JSON,
      Promise,
      URLSearchParams,
      window,
    })

    expect(await window.__registrationEmailVerificationRequest).toEqual(
      exchangeResponse
    )
    expect(trustedAttempts).toBe(2)
    expect(instrumentedAttempts).toBe(0)
  })

  test('turns repeated non-JSON gateway failures into a structured result', async () => {
    let attempts = 0
    const window: BootstrapWindow = {
      location: {
        pathname: '/sign-up/verify',
        search: '',
        hash: '#token=gateway-token',
      },
      history: {
        state: null,
        replaceState: () => {},
      },
      setTimeout: (callback) => {
        callback()
        return 0
      },
      fetch: async () => {
        attempts += 1
        return {
          json: async () => {
            throw new Error('gateway returned HTML')
          },
          ok: false,
          status: 502,
        }
      },
    }

    runInNewContext(getBootstrapScript(), {
      JSON,
      Promise,
      URLSearchParams,
      window,
    })

    expect(await window.__registrationEmailVerificationRequest).toEqual({
      success: false,
    })
    expect(attempts).toBe(3)
  })

  test('keeps the verification page independent from the sign-up form route', () => {
    const routeDefinition = routeTreeSource.match(
      /const authSignUpVerifyRoute = authSignUpVerifyRouteImport\.update\(\{[\s\S]*?\} as any\)/
    )?.[0]

    expect(routeDefinition).toContain('getParentRoute: () => authRouteRoute')
    expect(routeDefinition).not.toContain(
      'getParentRoute: () => authSignUpRoute'
    )
  })
})
