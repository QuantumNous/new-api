/*
Copyright (C) 2023-2026 QuantumNous
*/
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { Route as LogsRoute } from '@/routes/_authenticated/partner-oauth-clients/logs'
import { useAuthStore } from '@/stores/auth-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'

import { PartnerOAuthAuthorizationLogs } from '../authorization-logs'

const originalAdapter = api.defaults.adapter
const clientId = `pc_${'a'.repeat(32)}`
const requests: Record<string, unknown>[] = []
let response: { success: boolean; data?: unknown; message?: string }
let requestPending: Promise<void> | undefined
let releaseRequest: (() => void) | undefined

function renderLogs(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
) {
  const view = render(
    <QueryClientProvider client={client}>
      <PartnerOAuthAuthorizationLogs />
    </QueryClientProvider>
  )
  return { ...view, client }
}

beforeEach(() => {
  const bundle = createTestAuthBundle()
  useAuthStore.getState().auth.setBundle({
    ...bundle,
    user: {
      ...bundle.user,
      role: ROLE.ADMIN,
      permissions: {
        admin_permissions: { partner_oauth_client: { read: true } },
      },
    },
  })
  requests.length = 0
  response = { success: true, data: { items: [], total: 0 } }
  requestPending = undefined
  releaseRequest = undefined
  api.defaults.adapter = (async (config) => {
    expect(config.url).toBe('/api/partner-oauth/authorization-logs')
    requests.push(config.params as Record<string, unknown>)
    await requestPending
    return {
      config,
      data: response,
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }) as AxiosAdapter
})

afterEach(() => {
  releaseRequest?.()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  vi.restoreAllMocks()
})

describe('partner OAuth authorization logs', () => {
  it('keeps read-only and empty log views clear without exposing old audit entries', async () => {
    const { client } = renderLogs()
    expect(await screen.findByText('No authorization logs found')).toBeVisible()
    expect(
      screen.getByText(/historical audit records are not included/)
    ).toBeVisible()
    expect(requests).toEqual([{ page: 1, page_size: 20 }])
    client.clear()
  })

  it('shows loading, safe event details and server pagination', async () => {
    requestPending = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    response = {
      success: true,
      data: {
        total: 21,
        items: [
          {
            event_id: 'evt-1',
            created_at: 1735689600,
            action: 'partner_oauth.token.issue',
            success: true,
            reason: '',
            actor_user_id: 0,
            target_user_id: 12,
            client_id: clientId,
            binding_id: '',
            request_id: 'req1',
            ip: '127.0.0.1',
            route: '/oauth/token',
            status: 200,
          },
        ],
      },
    }
    const { client } = renderLogs()
    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
    expect(screen.queryByText('Token issued')).not.toBeInTheDocument()
    releaseRequest?.()
    expect(await screen.findByText('Token issued')).toBeVisible()
    expect(screen.getByText('req1')).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Go to next page' })
    )
    await waitFor(() =>
      expect(requests.at(-1)).toMatchObject({ page: 2, page_size: 20 })
    )
    client.clear()
  })

  it('keeps rows fetched by this page visible during a window-focus refetch', async () => {
    response = {
      success: true,
      data: {
        total: 1,
        items: [
          {
            event_id: 'evt-focus',
            created_at: 1735689600,
            action: 'partner_oauth.token.issue',
            success: true,
            reason: '',
            actor_user_id: 0,
            target_user_id: 12,
            client_id: clientId,
            binding_id: '',
            request_id: 'focus-request',
            ip: '127.0.0.1',
            route: '/oauth/token',
            status: 200,
          },
        ],
      },
    }
    const { client } = renderLogs()
    expect(await screen.findByText('focus-request')).toBeVisible()
    requestPending = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(screen.getByText('focus-request')).toBeVisible()
    releaseRequest?.()
    focusManager.setFocused(undefined)
    client.clear()
  })

  it('submits validated filters to the dedicated endpoint and blocks malformed IDs', async () => {
    const { client } = renderLogs()
    await screen.findByText('No authorization logs found')
    const user = userEvent.setup()
    await user.type(
      screen.getByRole('textbox', { name: 'Client ID' }),
      'not-a-client'
    )
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    expect(requests).toHaveLength(1)
    await user.clear(screen.getByRole('textbox', { name: 'Client ID' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Client ID' }),
      clientId
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Target user ID' }),
      '42'
    )
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() =>
      expect(requests.at(-1)).toMatchObject({
        page: 1,
        page_size: 20,
        client_id: clientId,
        target_user_id: 42,
      })
    )
    client.clear()
  })

  it('filters event, result and time range only after a valid search, then resets', async () => {
    const { client } = renderLogs()
    await screen.findByText('No authorization logs found')
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Event' }))
    await user.click(
      await screen.findByRole('option', { name: 'Consent denied' })
    )
    await user.click(screen.getByRole('combobox', { name: 'Result' }))
    await user.click(await screen.findByRole('option', { name: 'Failed' }))
    await user.click(screen.getByRole('button', { name: 'Date Range' }))
    fireEvent.change(screen.getByLabelText('Start Time'), {
      target: { value: '2025-01-02T00:00:00' },
    })
    fireEvent.change(screen.getByLabelText('End Time'), {
      target: { value: '2025-01-01T00:00:00' },
    })
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    expect(requests).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /2025-01-02/ }))
    fireEvent.change(screen.getByLabelText('End Time'), {
      target: { value: '2025-01-03T00:00:00' },
    })
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() =>
      expect(requests.at(-1)).toMatchObject({
        action: 'partner_oauth.consent.deny',
        success: 'false',
        start: Math.floor(new Date('2025-01-02T00:00:00').getTime() / 1000),
        end: Math.floor(new Date('2025-01-03T00:00:00').getTime() / 1000),
      })
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() =>
      expect(requests.at(-1)).toMatchObject({ page: 1, page_size: 20 })
    )
    expect(requests.at(-1)).not.toHaveProperty('action')
    client.clear()
  })

  it('hides cached rows while rechecking a reopened page and after read access is revoked', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const auth = useAuthStore.getState().auth
    const cached = {
      items: [
        {
          event_id: 'old-event',
          created_at: 1735689600,
          action: 'partner_oauth.token.issue',
          success: true,
          reason: '',
          actor_user_id: 0,
          target_user_id: 42,
          client_id: clientId,
          binding_id: '',
          request_id: 'old-request',
          ip: '',
          route: '/oauth/token',
          status: 200,
        },
      ],
      total: 1,
    }
    client.setQueryData(
      [
        'admin',
        'partner-oauth-authorization-logs',
        auth.user?.id,
        auth.session?.sid,
        { page: 1, page_size: 20 },
      ],
      cached
    )
    requestPending = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    response = { success: false, message: 'access denied' }
    renderLogs(client)
    expect(screen.queryByText('old-request')).not.toBeInTheDocument()
    await waitFor(() => expect(requests).toHaveLength(1))
    releaseRequest?.()
    expect(
      (await screen.findAllByText('Failed to load authorization logs'))[0]
    ).toBeVisible()
    expect(screen.queryByText('old-request')).not.toBeInTheDocument()
    client.clear()
  })

  it('shows a retryable error without presenting stale rows as successful results', async () => {
    response = { success: false, message: 'authorization logs unavailable' }
    const { client } = renderLogs()
    expect(
      (await screen.findAllByText('Failed to load authorization logs'))[0]
    ).toBeVisible()
    response = { success: true, data: { items: [], total: 0 } }
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No authorization logs found')).toBeVisible()
    client.clear()
  })

  it('redirects a direct log URL to 403 without read permission', async () => {
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle({
      ...bundle,
      user: {
        ...bundle.user,
        role: ROLE.ADMIN,
        permissions: { admin_permissions: {} },
      },
    })
    const root = createRootRoute()
    const forbidden = createRoute({ getParentRoute: () => root, path: '/403' })
    const logs = createRoute({
      getParentRoute: () => root,
      path: '/partner-oauth-clients/logs',
      beforeLoad: () => LogsRoute.options.beforeLoad?.({} as never),
    })
    const router = createRouter({
      routeTree: root.addChildren([logs, forbidden]),
      history: createMemoryHistory({ initialEntries: ['/403'] }),
    })
    await router.load()
    const matches = await router.preloadRoute({
      to: '/partner-oauth-clients/logs',
    })
    expect(matches?.at(-1)?.pathname).toBe('/403')
    expect(requests).toHaveLength(0)
  })

  it('does not request or display all-user logs when read permission is absent', () => {
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle({
      ...bundle,
      user: {
        ...bundle.user,
        role: ROLE.ADMIN,
        permissions: { admin_permissions: {} },
      },
    })
    const { client } = renderLogs()
    expect(screen.getByText('Access denied')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(requests).toHaveLength(0)
    client.clear()
  })
})
