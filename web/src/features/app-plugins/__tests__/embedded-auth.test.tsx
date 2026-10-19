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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { AppFrame } from '../app-frame'
import type {
  AppAuthorizeResult,
  AppLaunchContext,
  AppNavigationItem,
  EmbeddedReadyMessage,
} from '../types'

const context: AppLaunchContext = {
  app_key: 'seedance-repro',
  surface: 'embedded',
  start_url: 'https://seedance.example.test/tenant/demo/start-embedded',
  origin: 'https://seedance.example.test',
}
const ready: EmbeddedReadyMessage = {
  type: 'seedance.auth.ready',
  version: 1,
  transaction_id: 'transaction-1',
  state: 'A'.repeat(43),
  nonce: 'A'.repeat(43),
  code_challenge: 'A'.repeat(43),
}
const launchURL = `https://seedance.example.test/tenant/demo/callback?code=one-time-code&state=${ready.state}`
const seedanceApp: AppNavigationItem = {
  key: 'seedance-repro',
  name: { en: 'Seedance' },
  version: '1.0.0',
  enabled_surfaces: ['embedded'],
  dashboard_path: '/apps/seedance-repro',
  direct_url: '',
  granted_scopes: ['task.read'],
}
const otherApp: AppNavigationItem = {
  ...seedanceApp,
  key: 'other-app',
  name: { en: 'Other App' },
  dashboard_path: '/apps/other-app',
}
const otherContext: AppLaunchContext = {
  app_key: 'other-app',
  surface: 'embedded',
  start_url: 'https://other.example.test/start-embedded',
  origin: 'https://other.example.test',
}

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  useAuthStore.getState().auth.setBundle({
    access_token: 'dashboard-test-access',
    token_type: 'Bearer',
    access_expires_at: 2_000_000_000,
    user: { id: 1, username: 'alice', role: 1 },
    session: {
      sid: 'embedded-test-session',
      current: true,
      login_method: 'password',
      ip: '127.0.0.1',
      user_agent: 'vitest',
      created_at: 1,
      last_active_at: 1,
      expires_at: 2_000_000_000,
    },
  })
  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url === '/api/app_plugins') {
      return {
        data: {
          success: true,
          message: '',
          data: [seedanceApp],
        },
      }
    }
    if (
      url === '/api/app_plugins/seedance-repro/launch-context' &&
      config?.params?.surface === 'embedded'
    ) {
      return { data: { success: true, message: '', data: context } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.reset()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

function renderAppFrame(appKey = 'seedance-repro') {
  return render(
    <QueryClientProvider client={client}>
      <AppFrame appKey={appKey} />
    </QueryClientProvider>
  )
}

async function renderFrame(): Promise<HTMLIFrameElement> {
  renderAppFrame()
  return screen.findByTitle<HTMLIFrameElement>('Seedance')
}

async function sendMessage(
  frame: HTMLIFrameElement,
  init: MessageEventInit = {}
) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: context.origin,
        source: frame.contentWindow,
        data: ready,
        ...init,
      })
    )
  })
}

function authorizeResponse(
  result: AppAuthorizeResult = {
    launch_url: launchURL,
    surface: 'embedded',
    expires_in: 60,
  }
) {
  return vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url !== '/api/app_plugins/seedance-repro/authorize') {
      throw new Error(`Unexpected POST ${url}`)
    }
    return {
      data: {
        success: true,
        message: '',
        data: result,
      },
    }
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function ReadyDuringRender(props: { source: Window | null }) {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.origin,
      source: props.source,
      data: ready,
    })
  )
  return null
}

test('rejects forged embedded handshake messages', async () => {
  const post = authorizeResponse()
  const frame = await renderFrame()
  const forged: MessageEventInit[] = [
    { origin: 'https://seedance.example.test.attacker.example' },
    { source: window },
    { data: null },
    { data: { ...ready, version: 2 } },
    { data: { ...ready, transaction_id: '' } },
    { data: { ...ready, transaction_id: 'transaction 1' } },
    { data: { ...ready, transaction_id: 'transaction\n1' } },
    { data: { ...ready, transaction_id: 'transaction\u2003id' } },
    { data: { ...ready, transaction_id: 'transaction\u0080id' } },
    { data: { ...ready, transaction_id: 't'.repeat(256) } },
    { data: { ...ready, nonce: undefined } },
    { data: { ...ready, state: 'A'.repeat(42) } },
    { data: { ...ready, state: 'A'.repeat(44) } },
    { data: { ...ready, nonce: `${'A'.repeat(42)}+` } },
    { data: { ...ready, code_challenge: `${'A'.repeat(42)}B` } },
    { data: { ...ready, code_challenge: '' } },
    { data: { ...ready, launch_url: 'https://attacker.example/' } },
  ]
  for (const message of forged) {
    await sendMessage(frame, message)
    expect(frame).toHaveAttribute('src', context.start_url)
    expect(post).not.toHaveBeenCalled()
  }

  await sendMessage(frame)
  await waitFor(() => expect(frame).toHaveAttribute('src', launchURL))
})

test('handles ready at frame commit without postMessage secrets', async () => {
  const post = authorizeResponse()
  let committedSrc: string | null = null
  const observer = new MutationObserver(() => {
    const frame = screen.queryByTitle<HTMLIFrameElement>('Seedance')
    if (!frame) return
    observer.disconnect()
    committedSrc = frame.getAttribute('src')
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: context.origin,
        source: frame.contentWindow,
        data: ready,
      })
    )
  })
  observer.observe(document.body, { childList: true, subtree: true })
  const frame = await renderFrame()
  expect(committedSrc).toBe(context.start_url)
  const source = frame.contentWindow
  if (!source) throw new Error('Expected the current iframe browsing context')
  const childMessages = vi.spyOn(source, 'postMessage')
  const parentMessages = vi.spyOn(window, 'postMessage')
  const serializedSensitiveSurfaces = () =>
    JSON.stringify([
      childMessages.mock.calls,
      parentMessages.mock.calls,
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
      client
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state.data),
      { ...localStorage },
      { ...sessionStorage },
    ])
  const expectNoSensitivePersistence = () => {
    const serialized = serializedSensitiveSurfaces()
    for (const sensitiveValue of [
      context.start_url,
      launchURL,
      'one-time-code',
      'launch_url',
      'code_verifier',
      'dashboard-test-access',
      'AppService',
      'AppGrant',
    ]) {
      expect(serialized).not.toContain(sensitiveValue)
    }
  }

  expectNoSensitivePersistence()
  await waitFor(() => expect(frame).toHaveAttribute('src', launchURL))
  await sendMessage(frame)

  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenCalledWith(
    '/api/app_plugins/seedance-repro/authorize',
    {
      surface: 'embedded',
      transaction_id: ready.transaction_id,
      state: ready.state,
      nonce: ready.nonce,
      code_challenge: ready.code_challenge,
      code_challenge_method: 'S256',
    },
    expect.objectContaining({
      headers: expect.objectContaining({
        'Idempotency-Key': expect.any(String),
      }),
      singleUseAuthorization: true,
      skipErrorHandler: true,
    })
  )
  expectNoSensitivePersistence()
})

test('uses the restricted iframe sandbox', async () => {
  const frame = await renderFrame()

  expect(frame).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox'
  )
  expect(frame).toHaveAttribute('allow', 'clipboard-read; clipboard-write')
})

test('suppresses a duplicate valid transaction while authorization is pending', async () => {
  const authorization = deferred<{
    data: {
      success: boolean
      message: string
      data: AppAuthorizeResult
    }
  }>()
  const post = vi.spyOn(api, 'post').mockReturnValue(authorization.promise)
  const frame = await renderFrame()

  await sendMessage(frame)
  await sendMessage(frame)
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))

  authorization.resolve({
    data: {
      success: true,
      message: '',
      data: { launch_url: launchURL, surface: 'embedded', expires_in: 60 },
    },
  })
  await waitFor(() => expect(frame).toHaveAttribute('src', launchURL))
})

test.each([
  [
    'rejects a direct authorization result',
    {
      launch_url: launchURL,
      surface: 'direct',
      expires_in: 60,
    } satisfies AppAuthorizeResult,
  ],
  [
    'rejects an authorization launch URL from another origin',
    {
      launch_url: 'https://attacker.example/callback',
      surface: 'embedded',
      expires_in: 60,
    } satisfies AppAuthorizeResult,
  ],
])('%s', async (_name, result) => {
  authorizeResponse(result)
  const frame = await renderFrame()

  await sendMessage(frame)

  expect(await screen.findByText('App unavailable')).toBeInTheDocument()
})

test('shows loading while launch context is pending and an error for an unapproved app', async () => {
  const pendingContext = deferred<{
    data: {
      success: boolean
      message: string
      data: AppLaunchContext
    }
  }>()
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/app_plugins') {
      return {
        data: { success: true, message: '', data: [seedanceApp] },
      }
    }
    if (
      url === '/api/app_plugins/seedance-repro/launch-context' &&
      config?.params?.surface === 'embedded'
    ) {
      return pendingContext.promise
    }
    throw new Error(`Unexpected GET ${url}`)
  })

  renderAppFrame()
  expect(await screen.findByText('Loading...')).toBeInTheDocument()

  pendingContext.resolve({
    data: { success: true, message: '', data: context },
  })
  expect(
    await screen.findByTitle<HTMLIFrameElement>('Seedance')
  ).toHaveAttribute('src', context.start_url)

  cleanup()
  renderAppFrame('not-approved')
  expect(await screen.findByText('App unavailable')).toBeInTheDocument()
})

test('aborts and ignores a stale launch context after the app changes', async () => {
  const oldContext = deferred<{
    data: {
      success: boolean
      message: string
      data: AppLaunchContext
    }
  }>()
  let oldSignal: { readonly aborted: boolean } | undefined
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/app_plugins') {
      return {
        data: {
          success: true,
          message: '',
          data: [seedanceApp, otherApp],
        },
      }
    }
    if (url === '/api/app_plugins/seedance-repro/launch-context') {
      oldSignal = config?.signal
      return oldContext.promise
    }
    if (url === '/api/app_plugins/other-app/launch-context') {
      return { data: { success: true, message: '', data: otherContext } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const rendered = renderAppFrame()
  await waitFor(() => expect(oldSignal).toBeDefined())

  rendered.rerender(
    <QueryClientProvider client={client}>
      <AppFrame appKey='other-app' />
    </QueryClientProvider>
  )
  const frame = await screen.findByTitle<HTMLIFrameElement>('Other App')
  expect(oldSignal?.aborted).toBe(true)
  expect(frame).toHaveAttribute('src', otherContext.start_url)

  oldContext.resolve({
    data: { success: true, message: '', data: context },
  })
  await act(async () => undefined)
  expect(frame).toHaveAttribute('src', otherContext.start_url)
})

test('aborts and ignores a stale launch context after the session changes', async () => {
  const oldContext = deferred<{
    data: {
      success: boolean
      message: string
      data: AppLaunchContext
    }
  }>()
  const staleContext: AppLaunchContext = {
    ...context,
    start_url: 'https://stale.example.test/start-embedded',
    origin: 'https://stale.example.test',
  }
  let launchCalls = 0
  let oldSignal: { readonly aborted: boolean } | undefined
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/app_plugins') {
      return {
        data: { success: true, message: '', data: [seedanceApp] },
      }
    }
    if (url === '/api/app_plugins/seedance-repro/launch-context') {
      launchCalls += 1
      if (launchCalls === 1) {
        oldSignal = config?.signal
        return oldContext.promise
      }
      return { data: { success: true, message: '', data: context } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  renderAppFrame()
  await waitFor(() => expect(oldSignal).toBeDefined())

  await act(async () => {
    useAuthStore.getState().auth.setBundle({
      access_token: 'dashboard-test-access',
      token_type: 'Bearer',
      access_expires_at: 2_000_000_000,
      user: { id: 1, username: 'alice', role: 1 },
      session: {
        sid: 'replacement-session',
        current: true,
        login_method: 'password',
        ip: '127.0.0.1',
        user_agent: 'vitest',
        created_at: 1,
        last_active_at: 1,
        expires_at: 2_000_000_000,
      },
    })
  })

  const frame = await screen.findByTitle<HTMLIFrameElement>('Seedance')
  expect(oldSignal?.aborted).toBe(true)
  expect(frame).toHaveAttribute('src', context.start_url)

  oldContext.resolve({
    data: { success: true, message: '', data: staleContext },
  })
  await act(async () => undefined)
  expect(frame).toHaveAttribute('src', context.start_url)
})

test('aborts and ignores an authorization result from a stale session', async () => {
  const authorization = deferred<{
    data: {
      success: boolean
      message: string
      data: AppAuthorizeResult
    }
  }>()
  let authorizationSignal: { readonly aborted: boolean } | undefined
  vi.spyOn(api, 'post').mockImplementation(async (_url, _request, config) => {
    authorizationSignal = config?.signal
    return authorization.promise
  })
  const frame = await renderFrame()
  await sendMessage(frame)
  await waitFor(() => expect(authorizationSignal).toBeDefined())

  await act(async () => {
    useAuthStore.getState().auth.setBundle({
      access_token: 'dashboard-test-access',
      token_type: 'Bearer',
      access_expires_at: 2_000_000_000,
      user: { id: 1, username: 'alice', role: 1 },
      session: {
        sid: 'replacement-session',
        current: true,
        login_method: 'password',
        ip: '127.0.0.1',
        user_agent: 'vitest',
        created_at: 1,
        last_active_at: 1,
        expires_at: 2_000_000_000,
      },
    })
  })
  await waitFor(() => expect(authorizationSignal?.aborted).toBe(true))

  authorization.resolve({
    data: {
      success: true,
      message: '',
      data: { launch_url: launchURL, surface: 'embedded', expires_in: 60 },
    },
  })
  await act(async () => undefined)

  const currentFrame = await screen.findByTitle<HTMLIFrameElement>('Seedance')
  expect(currentFrame).toHaveAttribute('src', context.start_url)
  expect(currentFrame).not.toHaveAttribute('src', launchURL)
})

test('aborts and ignores an authorization result after the app changes', async () => {
  const authorization = deferred<{
    data: {
      success: boolean
      message: string
      data: AppAuthorizeResult
    }
  }>()
  let authorizationSignal: { readonly aborted: boolean } | undefined
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/app_plugins') {
      return {
        data: {
          success: true,
          message: '',
          data: [seedanceApp, otherApp],
        },
      }
    }
    if (url === '/api/app_plugins/seedance-repro/launch-context') {
      return { data: { success: true, message: '', data: context } }
    }
    if (url === '/api/app_plugins/other-app/launch-context') {
      return { data: { success: true, message: '', data: otherContext } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  vi.spyOn(api, 'post').mockImplementation(async (_url, _request, config) => {
    authorizationSignal = config?.signal
    return authorization.promise
  })
  const rendered = renderAppFrame()
  const frame = await screen.findByTitle<HTMLIFrameElement>('Seedance')
  await sendMessage(frame)
  await waitFor(() => expect(authorizationSignal).toBeDefined())

  rendered.rerender(
    <QueryClientProvider client={client}>
      <AppFrame appKey='other-app' />
    </QueryClientProvider>
  )

  const currentFrame = await screen.findByTitle<HTMLIFrameElement>('Other App')
  expect(authorizationSignal?.aborted).toBe(true)
  expect(currentFrame).toHaveAttribute('src', otherContext.start_url)

  authorization.resolve({
    data: {
      success: true,
      message: '',
      data: { launch_url: launchURL, surface: 'embedded', expires_in: 60 },
    },
  })
  await act(async () => undefined)
  expect(currentFrame).toHaveAttribute('src', otherContext.start_url)
})

test('aborts a pending launch context when approval is revoked', async () => {
  const pendingContext = deferred<{
    data: {
      success: boolean
      message: string
      data: AppLaunchContext
    }
  }>()
  let approvedApps = [seedanceApp]
  let contextSignal: { readonly aborted: boolean } | undefined
  const post = vi.spyOn(api, 'post')
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/app_plugins') {
      return {
        data: { success: true, message: '', data: approvedApps },
      }
    }
    if (url === '/api/app_plugins/seedance-repro/launch-context') {
      contextSignal = config?.signal
      return pendingContext.promise
    }
    throw new Error(`Unexpected GET ${url}`)
  })

  renderAppFrame()
  await waitFor(() => expect(contextSignal).toBeDefined())

  approvedApps = []
  await act(async () => {
    await client.invalidateQueries({
      queryKey: ['app-plugins', 'navigation', 'embedded-test-session'],
    })
  })

  await waitFor(() => expect(contextSignal?.aborted).toBe(true))
  expect(await screen.findByText('App unavailable')).toBeInTheDocument()

  pendingContext.resolve({
    data: { success: true, message: '', data: context },
  })
  await act(async () => undefined)

  expect(screen.queryByRole('iframe')).not.toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})

test('aborts pending authorization and rejects ready during approval revocation', async () => {
  const authorization = deferred<{
    data: {
      success: boolean
      message: string
      data: AppAuthorizeResult
    }
  }>()
  let approvedApps = [seedanceApp]
  let authorizationSignal: { readonly aborted: boolean } | undefined
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/app_plugins') {
      return {
        data: { success: true, message: '', data: approvedApps },
      }
    }
    if (url === '/api/app_plugins/seedance-repro/launch-context') {
      return { data: { success: true, message: '', data: context } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const post = vi
    .spyOn(api, 'post')
    .mockImplementation(async (_url, _request, config) => {
      authorizationSignal = config?.signal
      return authorization.promise
    })
  const frame = await renderFrame()
  await sendMessage(frame)
  await waitFor(() => expect(authorizationSignal).toBeDefined())

  approvedApps = []
  await act(async () => {
    await client.invalidateQueries({
      queryKey: ['app-plugins', 'navigation', 'embedded-test-session'],
    })
  })

  await waitFor(() => expect(authorizationSignal?.aborted).toBe(true))
  expect(await screen.findByText('App unavailable')).toBeInTheDocument()
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.origin,
      source: frame.contentWindow,
      data: { ...ready, transaction_id: 'transaction-after-revocation' },
    })
  )
  expect(api.post).toHaveBeenCalledTimes(1)

  authorization.resolve({
    data: {
      success: true,
      message: '',
      data: { launch_url: launchURL, surface: 'embedded', expires_in: 60 },
    },
  })
  await act(async () => undefined)

  expect(screen.queryByRole('iframe')).not.toBeInTheDocument()

  cleanup()
  client.clear()
  approvedApps = [seedanceApp]
  post.mockClear()
  post.mockResolvedValue({
    data: {
      success: true,
      message: '',
      data: { launch_url: launchURL, surface: 'embedded', expires_in: 60 },
    },
  })
  const rendered = renderAppFrame()
  const currentFrame = await screen.findByTitle<HTMLIFrameElement>('Seedance')
  await act(async () => {
    client.setQueryData(
      ['app-plugins', 'navigation', 'embedded-test-session'],
      []
    )
    rendered.rerender(
      <QueryClientProvider client={client}>
        <AppFrame appKey='seedance-repro' />
        <ReadyDuringRender source={currentFrame.contentWindow} />
      </QueryClientProvider>
    )
  })

  expect(await screen.findByText('App unavailable')).toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})

test('fails closed when an app-list refetch errors with stale approval data', async () => {
  let listError: Error | null = null
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/app_plugins') {
      if (listError) throw listError
      return {
        data: { success: true, message: '', data: [seedanceApp] },
      }
    }
    if (url === '/api/app_plugins/seedance-repro/launch-context') {
      return { data: { success: true, message: '', data: context } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  await renderFrame()

  listError = new Error('app list unavailable')
  await act(async () => {
    await client.refetchQueries({
      queryKey: ['app-plugins', 'navigation', 'embedded-test-session'],
    })
  })

  expect(await screen.findByText('app list unavailable')).toBeInTheDocument()
  expect(screen.queryByRole('iframe')).not.toBeInTheDocument()
})
