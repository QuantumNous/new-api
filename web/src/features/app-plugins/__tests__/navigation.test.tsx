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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest'

import { NavGroup } from '@/components/layout/components/nav-group'
import { SidebarProvider } from '@/components/ui/sidebar'
import { SearchProvider } from '@/context/search-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { useSidebarView } from '@/hooks/use-sidebar-view'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import {
  authorizeApp,
  getAppLaunchContext,
  listAppPlugins,
  resolveAppNavigation,
} from '../api'
import type {
  AppAuthorizeRequest,
  AppAuthorizeResult,
  AppLaunchContext,
  AppNavigationItem,
  AppSurface,
} from '../types'

const seedance: AppNavigationItem = {
  key: 'seedance-repro',
  name: { en: 'Seedance' },
  version: '1.0.0',
  enabled_surfaces: ['embedded'],
  dashboard_path: '/apps/seedance-repro',
  direct_url: '',
  granted_scopes: ['task.read'],
}

let client: QueryClient
const originalGetAnimations = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (originalGetAnimations) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      originalGetAnimations
    )
    return
  }
  Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
})

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  useAuthStore.getState().auth.setBundle({
    access_token: 'dashboard-test-access',
    token_type: 'Bearer',
    access_expires_at: 2_000_000_000,
    user: { id: 1, username: 'alice', role: 1 },
    session: {
      sid: 'navigation-test-session',
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

afterEach(async () => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.reset()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
  await i18next.changeLanguage('en')
})

function Navigation() {
  const sidebarView = useSidebarView()
  return sidebarView.navGroups.map((group) => (
    <NavGroup key={group.id ?? group.title} {...group} />
  ))
}

async function renderNavigation(apps: AppNavigationItem[] | Error) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/app_plugins') {
      if (apps instanceof Error) throw apps
      return { data: { success: true, message: '', data: apps } }
    }
    if (url === '/api/status') {
      return {
        data: {
          success: true,
          message: '',
          data: {
            chats: [{ 'Infinite Canvas': 'https://canvas.example.test/' }],
          },
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const router = createRouter({
    routeTree: createRootRoute({ component: Navigation }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <SidebarProvider>
        <RouterProvider router={router} />
      </SidebarProvider>
    </QueryClientProvider>
  )
}

test('renders only server-approved app surfaces', async () => {
  await renderNavigation([seedance])

  expect(await screen.findByRole('link', { name: 'Seedance' })).toHaveAttribute(
    'href',
    '/apps/seedance-repro'
  )
  expect(
    screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/apps/'))
  ).toHaveLength(1)
  expect(
    document.querySelector('a[href*="surface=direct"]')
  ).not.toBeInTheDocument()
  expect(
    client.getQueryState([
      'app-plugins',
      'navigation',
      'navigation-test-session',
    ])
  ).toBeDefined()
})

test('keeps Infinite Canvas and Seedance as separate navigation items', async () => {
  await renderNavigation([seedance])
  const appLink = await screen.findByRole('link', { name: 'Seedance' })
  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: 'Chat' }))
  const canvasLink = await screen.findByRole('link', {
    name: 'Infinite Canvas',
  })

  expect(appLink).toHaveAttribute('href', '/apps/seedance-repro')
  expect(canvasLink).toHaveAttribute('href', '/chat/0')
  expect(appLink.closest('li')).not.toBe(canvasLink.closest('li'))
})

test('rejects unregistered app navigation', () => {
  const rejected: Array<[string, AppSurface]> = [
    ['/apps/unregistered', 'embedded'],
    ['/keys', 'embedded'],
    ['https://attacker.example/apps/seedance-repro', 'embedded'],
    ['//attacker.example/apps/seedance-repro', 'embedded'],
    ['/apps/seedance-repro', 'direct'],
  ]
  for (const [path, surface] of rejected) {
    expect(resolveAppNavigation([seedance], path, surface)).toBeNull()
  }
  expect(
    resolveAppNavigation(
      [{ ...seedance, dashboard_path: '/keys' }],
      '/keys',
      'embedded'
    )
  ).toBeNull()
  expect(
    resolveAppNavigation(
      [{ ...seedance, enabled_surfaces: [] }],
      '/apps/seedance-repro',
      'embedded'
    )
  ).toBeNull()
  expect(
    resolveAppNavigation([seedance], '/apps/seedance-repro', 'embedded')
  ).toEqual(seedance)
})

test('resolves app labels by active language, English, first label, then key', async () => {
  await i18next.changeLanguage('fr')
  await renderNavigation([
    {
      ...seedance,
      key: 'active',
      dashboard_path: '/apps/active',
      name: { fr: 'Actif', en: 'Active' },
    },
    {
      ...seedance,
      key: 'english',
      dashboard_path: '/apps/english',
      name: { en: 'English' },
    },
    {
      ...seedance,
      key: 'first',
      dashboard_path: '/apps/first',
      name: { vi: 'First server label', ja: 'Second server label' },
    },
    { ...seedance, key: 'app-key', dashboard_path: '/apps/app-key', name: {} },
  ])

  expect(await screen.findByRole('link', { name: 'Actif' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'English' })).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'First server label' })
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'app-key' })).toBeInTheDocument()
})

test('preserves static navigation when the app list fails', async () => {
  await renderNavigation(new Error('app list unavailable'))

  expect(
    await screen.findByRole('link', { name: 'Playground' })
  ).toHaveAttribute('href', '/playground')
  expect(
    screen.queryByRole('link', { name: 'Seedance' })
  ).not.toBeInTheDocument()
})

test('removes stale App navigation when an app-list refetch fails', async () => {
  let listError: Error | null = null
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/app_plugins') {
      if (listError) throw listError
      return { data: { success: true, message: '', data: [seedance] } }
    }
    if (url === '/api/status') {
      return {
        data: { success: true, message: '', data: { chats: [] } },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const router = createRouter({
    routeTree: createRootRoute({ component: Navigation }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <SidebarProvider>
        <RouterProvider router={router} />
      </SidebarProvider>
    </QueryClientProvider>
  )
  expect(
    await screen.findByRole('link', { name: 'Seedance' })
  ).toBeInTheDocument()

  listError = new Error('app list unavailable')
  await act(async () => {
    await client.refetchQueries({
      queryKey: ['app-plugins', 'navigation', 'navigation-test-session'],
    })
  })

  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'Seedance' })
    ).not.toBeInTheDocument()
  )
  expect(screen.getByRole('link', { name: 'Playground' })).toBeInTheDocument()
})

test('shows an approved App command in the real root CommandMenu', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/app_plugins') {
      return { data: { success: true, message: '', data: [seedance] } }
    }
    if (url === '/api/status') {
      return {
        data: { success: true, message: '', data: { chats: [] } },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <ThemeProvider>
          <SearchProvider>
            <div>Root path</div>
          </SearchProvider>
        </ThemeProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )

  fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

  expect(await screen.findByText('Seedance')).toBeInTheDocument()
})

test('lists apps with the authenticated client and rejects failed envelopes', async () => {
  const controller = new AbortController()
  const get = vi.spyOn(api, 'get').mockResolvedValueOnce({
    data: { success: true, message: '', data: [seedance] },
  })

  await expect(listAppPlugins(controller.signal)).resolves.toEqual([seedance])
  expect(get).toHaveBeenCalledWith('/api/app_plugins', {
    signal: controller.signal,
    skipErrorHandler: true,
  })

  get.mockResolvedValueOnce({
    data: { success: false, message: 'apps rejected', data: [] },
  })
  await expect(listAppPlugins()).rejects.toThrow('apps rejected')
})

const launchContext: AppLaunchContext = {
  app_key: seedance.key,
  surface: 'embedded',
  start_url: 'https://seedance.example.test/start-embedded',
  origin: 'https://seedance.example.test',
}
const authorizeRequest: AppAuthorizeRequest = {
  surface: 'embedded',
  transaction_id: 'transaction-1',
  state: 'A'.repeat(43),
  nonce: 'A'.repeat(43),
  code_challenge: 'A'.repeat(43),
  code_challenge_method: 'S256',
}
const authorization: AppAuthorizeResult = {
  launch_url: 'https://seedance.example.test/callback?code=one-time-code',
  surface: 'embedded',
  expires_in: 60,
}
const endpoints = [
  { name: 'navigation', call: () => listAppPlugins(), data: [seedance] },
  {
    name: 'launch context',
    call: () => getAppLaunchContext(seedance.key, 'embedded'),
    data: launchContext,
  },
  {
    name: 'authorization',
    call: () => authorizeApp(seedance.key, authorizeRequest, 'request-1'),
    data: authorization,
  },
]

test.each(endpoints)(
  'rejects missing or nonboolean success in $name responses',
  async ({ call, data }) => {
    const get = vi.spyOn(api, 'get')
    const post = vi.spyOn(api, 'post')
    const bodies = [
      { data },
      { success: 'false', data },
      { success: 'true', data },
      { success: 1, data },
      { success: null, data },
      null,
      [],
    ]
    for (const body of bodies) {
      get.mockResolvedValue({ data: body })
      post.mockResolvedValue({ data: body })
      await expect(call()).rejects.toThrow('App unavailable')
    }
  }
)

test.each([
  ['null list', null],
  ['nonarray list', {}],
  ['null item', [null]],
  ['missing item fields', [{ key: seedance.key }]],
  ['nonstring label', [{ ...seedance, name: { en: 1 } }]],
  ['array labels', [{ ...seedance, name: ['Seedance'] }]],
  ['nonarray surfaces', [{ ...seedance, enabled_surfaces: 'embedded' }]],
  ['unknown surface', [{ ...seedance, enabled_surfaces: ['other'] }]],
  ['nonstring scope', [{ ...seedance, granted_scopes: [1] }]],
  ['nonstring version', [{ ...seedance, version: 1 }]],
  ['missing direct URL', [{ ...seedance, direct_url: undefined }]],
  ['nonstring dashboard path', [{ ...seedance, dashboard_path: null }]],
])('rejects malformed navigation: %s', async (_name, data) => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, message: 'one-time-code', data },
  })

  await expect(listAppPlugins()).rejects.toThrow('App unavailable')
})

test.each([
  ['null context', null],
  ['array context', []],
  ['missing fields', {}],
  ['nonstring app key', { ...launchContext, app_key: 1 }],
  ['unknown surface', { ...launchContext, surface: 'other' }],
  ['nonstring start URL', { ...launchContext, start_url: null }],
  ['missing origin', { ...launchContext, origin: undefined }],
])('rejects malformed launch context: %s', async (_name, data) => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data } })

  await expect(getAppLaunchContext(seedance.key, 'embedded')).rejects.toThrow(
    'App unavailable'
  )
})

test.each([
  ['null authorization', null],
  ['array authorization', []],
  ['missing fields', {}],
  ['nonstring launch URL', { ...authorization, launch_url: null }],
  ['unknown surface', { ...authorization, surface: 'other' }],
  ['missing expiry', { ...authorization, expires_in: undefined }],
  ['string expiry', { ...authorization, expires_in: '60' }],
  ['wrong numeric expiry', { ...authorization, expires_in: 61 }],
])('rejects malformed authorization: %s', async (_name, data) => {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, message: 'one-time-code', data },
  })

  await expect(
    authorizeApp(seedance.key, authorizeRequest, 'request-1')
  ).rejects.toThrow('App unavailable')
})

test.each(endpoints)(
  'preserves explicit business rejection message and cause for $name',
  async ({ call }) => {
    const body = {
      success: false,
      message: 'apps rejected',
      data: null,
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: body })
    vi.spyOn(api, 'post').mockResolvedValue({ data: body })

    await expect(call()).rejects.toMatchObject({
      message: 'apps rejected',
      cause: body,
    })
  }
)

test.each(endpoints)(
  'does not expose malformed response details for $name',
  async ({ call }) => {
    const body = {
      success: 'false',
      message: 'one-time-code',
      data: authorization,
    }
    vi.spyOn(api, 'get').mockResolvedValue({ data: body })
    vi.spyOn(api, 'post').mockResolvedValue({ data: body })

    const error = await call().catch((value: unknown) => value)
    expect(error).toBeInstanceOf(Error)
    expect(error).toHaveProperty('message', 'App unavailable')
    expect(error).not.toHaveProperty('cause')
    expect(error).not.toHaveProperty('issues')
  }
)

test('accepts empty and minimally populated navigation without new registration semantics', async () => {
  const minimal: AppNavigationItem = {
    ...seedance,
    name: {},
    version: '',
    enabled_surfaces: [],
    direct_url: '',
    granted_scopes: [],
  }
  const get = vi.spyOn(api, 'get').mockResolvedValueOnce({
    data: { success: true, data: [] },
  })
  await expect(listAppPlugins()).resolves.toEqual([])
  get.mockResolvedValueOnce({ data: { success: true, data: [minimal] } })
  await expect(listAppPlugins()).resolves.toEqual([minimal])
})

test('accepts valid launch and authorization payloads for both surfaces', async () => {
  const get = vi.spyOn(api, 'get')
  const post = vi.spyOn(api, 'post')
  const controller = new AbortController()
  for (const surface of ['direct', 'embedded'] as const) {
    const context = { ...launchContext, surface }
    const result = { ...authorization, surface }
    get.mockResolvedValueOnce({ data: { success: true, data: context } })
    post.mockResolvedValueOnce({ data: { success: true, data: result } })

    await expect(
      getAppLaunchContext('app/key', surface, controller.signal)
    ).resolves.toEqual(context)
    expect(get).toHaveBeenLastCalledWith(
      '/api/app_plugins/app%2Fkey/launch-context',
      { params: { surface }, signal: controller.signal, skipErrorHandler: true }
    )
    const request = { ...authorizeRequest, surface }
    await expect(
      authorizeApp('app/key', request, 'request-1', controller.signal)
    ).resolves.toEqual(result)
    expect(post).toHaveBeenLastCalledWith(
      '/api/app_plugins/app%2Fkey/authorize',
      request,
      {
        headers: { 'Idempotency-Key': 'request-1' },
        signal: controller.signal,
        singleUseAuthorization: true,
        skipErrorHandler: true,
      }
    )
  }
})
