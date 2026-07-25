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

const html = readFileSync(
  new URL('../../../index.html', import.meta.url),
  'utf8'
)
const bootstrapScript = Array.from(
  html.matchAll(/<script>([\s\S]*?GTM-NKH9LPX9[\s\S]*?)<\/script>/g)
)[0]?.[1]

function runBootstrap(href: string, storedValues: Record<string, string> = {}) {
  const insertedScripts: Array<{ src?: string }> = []
  const sessionValues = new Map(Object.entries(storedValues))
  const firstScript = {
    parentNode: {
      insertBefore(script: { src?: string }) {
        insertedScripts.push(script)
      },
    },
  }
  const window = {
    location: { href },
    sessionStorage: {
      getItem: (key: string) => sessionValues.get(key) ?? null,
      removeItem: (key: string) => sessionValues.delete(key),
    },
  } as {
    dataLayer?: unknown[]
    location: { href: string }
    sessionStorage: {
      getItem: (key: string) => string | null
      removeItem: (key: string) => boolean
    }
  }
  const document = {
    createElement: () => ({}),
    getElementsByTagName: () => [firstScript],
  }

  expect(bootstrapScript).toBeTruthy()
  runInNewContext(bootstrapScript!, {
    Date,
    URL,
    document,
    window,
  })

  return { insertedScripts, sessionValues, window }
}

function deeplyNestedRecallURL(): string {
  let redirect = '/console/topup?recall_claim=signed-secret'
  for (let depth = 0; depth < 4; depth += 1) {
    redirect = `/sign-in?redirect=${encodeURIComponent(redirect)}`
  }
  return `https://console.example.com${redirect}`
}

describe('GTM bootstrap recall claim isolation', () => {
  test('does not create dataLayer or load GTM for a direct recall claim', () => {
    const result = runBootstrap(
      'https://console.example.com/sign-in?recall_claim=signed-secret'
    )

    expect(result.window.dataLayer).toBeUndefined()
    expect(result.insertedScripts).toHaveLength(0)
  })

  test('does not create dataLayer or load GTM for a nested recall claim', () => {
    const redirect = '/console/topup?recall_claim=signed-secret'
    const result = runBootstrap(
      `https://console.example.com/sign-in?redirect=${encodeURIComponent(redirect)}`
    )

    expect(result.window.dataLayer).toBeUndefined()
    expect(result.insertedScripts).toHaveLength(0)
  })

  test('fails closed when a recall claim exceeds redirect inspection depth', () => {
    const result = runBootstrap(deeplyNestedRecallURL())

    expect(result.window.dataLayer).toBeUndefined()
    expect(result.insertedScripts).toHaveLength(0)
  })

  test('does not load GTM when a scrubbed OAuth callback keeps a valid recall claim in storage', () => {
    const result = runBootstrap('https://console.example.com/oauth/google', {
      auth_post_login_redirect: JSON.stringify({
        nonce: 'oauth-recall-flow',
        rawTarget: '/console/topup?recall_claim=signed-secret',
        sanitizedTarget: '/console/topup',
        createdAt: Date.now(),
      }),
      auth_oauth_redirect_nonce: 'oauth-recall-flow',
    })

    expect(result.window.dataLayer).toBeUndefined()
    expect(result.insertedScripts).toHaveLength(0)
  })

  test('cleans an expired stored recall claim before loading GTM', () => {
    const result = runBootstrap('https://console.example.com/oauth/google', {
      auth_post_login_redirect: JSON.stringify({
        nonce: 'expired-recall-flow',
        rawTarget: '/console/topup?recall_claim=expired-secret',
        sanitizedTarget: '/console/topup',
        createdAt: Date.now() - 31 * 60 * 1000,
      }),
      auth_oauth_redirect_nonce: 'expired-recall-flow',
    })

    expect(result.insertedScripts).toHaveLength(2)
    expect(result.sessionValues.has('auth_post_login_redirect')).toBe(false)
    expect(result.sessionValues.has('auth_oauth_redirect_nonce')).toBe(false)
  })

  test('loads both configured GTM containers for an ordinary URL', () => {
    const result = runBootstrap(
      'https://console.example.com/sign-in?redirect=%2Fkeys'
    )

    expect(result.window.dataLayer).toHaveLength(2)
    expect(result.insertedScripts.map((script) => script.src)).toEqual([
      'https://www.googletagmanager.com/gtm.js?id=GTM-NKH9LPX9',
      'https://www.googletagmanager.com/gtm.js?id=GTM-5T5LPLSZ',
    ])
  })

  test('does not expose a noscript GTM fallback', () => {
    expect(html).not.toContain('googletagmanager.com/ns.html')
  })
})
