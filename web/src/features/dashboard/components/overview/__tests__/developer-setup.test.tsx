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
import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useConsoleModeStore } from '@/stores/console-mode-store'
import { createTestAuthBundle } from '@/test-utils/auth-bundle'
import { renderApp } from '@/test-utils/render-app'

import { DeveloperSetupGuide } from '../developer-setup-guide'

let client: QueryClient
const initialAuth = useAuthStore.getState()
const initialMode = useConsoleModeStore.getState().mode

beforeEach(() => {
  window.localStorage.clear()
  useConsoleModeStore.getState().setMode('developer')
  const bundle = createTestAuthBundle()
  useAuthStore.getState().auth.setBundle({
    ...bundle,
    user: {
      ...bundle.user,
      username: 'developer',
      quota: 0,
      used_quota: 0,
      request_count: 0,
    },
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(['status'], {
    api_info_enabled: false,
    announcements_enabled: false,
    faq_enabled: false,
    uptime_kuma_enabled: false,
  })
  client.setQueryData(['dashboard', 'overview', 'api-keys', bundle.user.id], [])
  client.setQueryData(
    ['dashboard', 'overview', 'user-models', bundle.user.id, 'default'],
    ['example-model']
  )
  client.setQueryData(['pricing'], {
    success: true,
    data: [
      {
        id: 1,
        model_name: 'example-model',
        quota_type: 0,
        model_ratio: 1,
        completion_ratio: 1,
        enable_groups: ['default'],
        supported_endpoint_types: ['openai'],
      },
    ],
    vendors: [],
    group_ratio: {},
    usable_group: {},
    supported_endpoint: {},
    auto_groups: [],
  })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/log/self/summary') {
      return {
        data: {
          success: true,
          data: {
            requests: 0,
            succeeded: 0,
            failed: 0,
            tokens: 0,
            quota: 0,
            saved_quota: 0,
            comparable_requests: 0,
            daily: [],
          },
        },
      }
    }
    if (url.startsWith('/api/log/self?')) {
      return { data: { success: true, data: { items: [], total: 0 } } }
    }
    return { data: { success: true, data: [] } }
  })
})

afterEach(() => {
  client.clear()
  useAuthStore.setState(initialAuth)
  useConsoleModeStore.getState().setMode(initialMode)
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('developer setup guide', () => {
  it('keeps setup in a compact disclosure and saves the collapsed preference', async () => {
    const user = userEvent.setup()
    const rendered = await renderApp(<DeveloperSetupGuide />, client)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Hide setup guide' })
      ).toBeVisible()
    )
    expect(
      screen.getByRole('link', { name: /Keep enough balance/ })
    ).toHaveAttribute('href', '/wallet')
    expect(
      screen.getByRole('link', { name: /Verify routing/ })
    ).toHaveAttribute('href', '/playground')
    expect(
      screen.queryByText('Build on your API gateway in minutes')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy Base URL' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Configure upstream providers/ })
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Hide setup guide' }))
    await waitFor(() =>
      expect(screen.getByText('Setup progress: 0/3')).toBeVisible()
    )
    expect(
      screen.getByRole('button', { name: 'Show setup guide' })
    ).toHaveAttribute('aria-expanded', 'false')
    rendered.unmount()
    await renderApp(<DeveloperSetupGuide />, client)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Show setup guide' })
      ).toBeVisible()
    )
    await user.click(screen.getByRole('button', { name: 'Show setup guide' }))
    await waitFor(() =>
      expect(screen.getByText('First API request')).toBeVisible()
    )
  })

  it('retrieves the real key only when copying a ready-to-run request', async () => {
    const user = userEvent.setup()
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    const reveal = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: { key: 'sk-example-preview-key' } },
    })
    client.setQueryData(
      [
        'dashboard',
        'overview',
        'api-keys',
        useAuthStore.getState().auth.user?.id,
      ],
      [
        {
          id: 42,
          status: 1,
          name: 'test key',
          key: 'masked****',
          group: 'default',
          model_limits_enabled: false,
          model_limits: '',
        },
      ]
    )
    await renderApp(<DeveloperSetupGuide />, client)
    expect(reveal).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Copy ready-to-run curl' })
    )
    await waitFor(() => expect(clipboard).toHaveBeenCalled())
    expect(reveal).toHaveBeenCalledWith('/api/token/42/key')
    const command = clipboard.mock.calls[0][0]
    expect(command).toContain('Authorization: Bearer sk-example-preview-key')
    expect(command).toContain('"model":"example-model"')
    expect(command).not.toContain('masked')
    expect(screen.queryByText(/sk-example-preview-key/)).toBeNull()
  })

  it('copies a Chat Completions model available to the selected key group', async () => {
    const user = userEvent.setup()
    const userId = useAuthStore.getState().auth.user?.id
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: { key: 'sk-compatible-key' } },
    })
    client.setQueryData(
      ['dashboard', 'overview', 'api-keys', userId],
      [
        {
          id: 42,
          status: 1,
          name: 'default key',
          key: 'masked****',
          group: 'default',
          model_limits_enabled: false,
          model_limits: '',
        },
      ]
    )
    client.removeQueries({
      queryKey: ['dashboard', 'overview', 'user-models', userId],
    })
    client.removeQueries({ queryKey: ['pricing'] })
    vi.mocked(api.get).mockImplementation(async (url, config) => {
      if (url === '/api/user/models') {
        return {
          data: {
            success: true,
            data:
              config?.params?.group === 'default'
                ? ['default-responses', 'default-chat']
                : ['vip-chat', 'default-responses', 'default-chat'],
          },
        }
      }
      if (url === '/api/pricing') {
        return {
          data: {
            success: true,
            data: [
              {
                id: 1,
                model_name: 'vip-chat',
                quota_type: 0,
                model_ratio: 1,
                completion_ratio: 1,
                enable_groups: ['vip'],
                supported_endpoint_types: ['openai'],
              },
              {
                id: 2,
                model_name: 'default-responses',
                quota_type: 0,
                model_ratio: 1,
                completion_ratio: 1,
                enable_groups: ['default'],
                supported_endpoint_types: ['openai-response'],
              },
              {
                id: 3,
                model_name: 'default-chat',
                quota_type: 0,
                model_ratio: 1,
                completion_ratio: 1,
                enable_groups: ['default'],
                supported_endpoint_types: ['openai'],
              },
            ],
            vendors: [],
            group_ratio: {},
            usable_group: {},
            supported_endpoint: {},
            auto_groups: [],
          },
        }
      }
      return { data: { success: true, data: [] } }
    })

    await renderApp(<DeveloperSetupGuide />, client)
    const copyButton = await screen.findByRole('button', {
      name: 'Copy ready-to-run curl',
    })
    await waitFor(() => expect(copyButton).toBeEnabled())
    await user.click(copyButton)
    await waitFor(() => expect(clipboard).toHaveBeenCalled())

    const command = clipboard.mock.calls[0][0]
    expect(command).toContain('"model":"default-chat"')
    expect(command).not.toContain('vip-chat')
    expect(command).not.toContain('default-responses')
  })

  it('copies the Base URL without revealing an API key or expanding setup', async () => {
    const user = userEvent.setup()
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    const reveal = vi.spyOn(api, 'post')
    window.localStorage.setItem(
      'dashboard_overview_setup_guide_expanded',
      'collapsed'
    )
    await renderApp(<DeveloperSetupGuide />, client)
    await user.click(screen.getByRole('button', { name: 'Copy Base URL' }))
    await waitFor(() =>
      expect(clipboard).toHaveBeenCalledWith(`${window.location.origin}/v1`)
    )
    expect(reveal).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Show setup guide' })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows loading instead of an empty model list until model discovery finishes', async () => {
    const userId = useAuthStore.getState().auth.user?.id
    client.setQueryData(
      ['dashboard', 'overview', 'api-keys', userId],
      [
        {
          id: 42,
          status: 1,
          name: 'test key',
          key: 'masked****',
          group: 'default',
          model_limits_enabled: false,
          model_limits: '',
        },
      ]
    )
    client.removeQueries({
      queryKey: ['dashboard', 'overview', 'user-models', userId, 'default'],
    })
    let resolveModels: (value: {
      data: { success: boolean; data: string[] }
    }) => void = () => {}
    vi.mocked(api.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveModels = resolve
        })
    )
    await renderApp(<DeveloperSetupGuide />, client)
    expect(screen.getByText('Loading...')).toBeVisible()
    expect(screen.queryByText('No models available')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy ready-to-run curl' })
    ).toBeDisabled()
    resolveModels({ data: { success: true, data: [] } })
    expect(await screen.findByText('No models available')).toBeVisible()
  })
})

describe('setup key routing', () => {
  it('loads models from the user group when the key inherits its group', async () => {
    const auth = useAuthStore.getState().auth
    expect(auth.user).not.toBeNull()
    if (!auth.user) throw new Error('Missing authenticated user fixture')
    auth.setUser({ ...auth.user, group: 'inherited' })
    const userId = auth.user?.id
    client.setQueryData(
      ['dashboard', 'overview', 'api-keys', userId],
      [
        {
          id: 42,
          status: 1,
          key: 'masked',
          group: '',
          model_limits_enabled: false,
        },
      ]
    )
    client.removeQueries({ queryKey: ['dashboard', 'overview', 'user-models'] })
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: ['example-model'] },
    })
    await renderApp(<DeveloperSetupGuide />, client)
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Copy ready-to-run curl',
        })
      ).toBeEnabled()
    )
    expect(api.get).toHaveBeenCalledWith('/api/user/models', {
      params: { group: 'inherited' },
    })
  })

  it.each([
    ['allowed-chat', ['blocked-chat', 'allowed-chat'], 'allowed-chat'],
    ['', ['blocked-chat'], null],
    [null, ['blocked-chat'], null],
    ['unavailable-chat', ['blocked-chat'], null],
    [
      'gpt-4o-gizmo-*',
      ['blocked-chat', 'gpt-4o-gizmo-demo'],
      'gpt-4o-gizmo-demo',
    ],
    [
      'gpt-4o-gizmo-demo',
      ['blocked-chat', 'gpt-4o-gizmo-demo'],
      'gpt-4o-gizmo-demo',
    ],
    [
      'gemini-2.5-flash-lite-thinking-*',
      ['gemini-2.5-flash-lite-thinking-128'],
      'gemini-2.5-flash-lite-thinking-128',
    ],
  ])(
    'applies allowlist %s to available models %j',
    async (limits, models, expected) => {
      const user = userEvent.setup()
      const clipboard = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue()
      const reveal = vi.spyOn(api, 'post').mockResolvedValue({
        data: { success: true, data: { key: 'sk-test' } },
      })
      const id = useAuthStore.getState().auth.user?.id
      client.setQueryData(
        ['dashboard', 'overview', 'api-keys', id],
        [
          {
            id: 42,
            status: 1,
            key: 'masked',
            group: 'default',
            model_limits_enabled: true,
            model_limits: limits,
          },
        ]
      )
      client.setQueryData(
        ['dashboard', 'overview', 'user-models', id, 'default'],
        models
      )
      client.setQueryData(['pricing'], {
        success: true,
        data: models.map((model_name) => ({
          model_name,
          supported_endpoint_types: ['openai'],
        })),
      })
      await renderApp(<DeveloperSetupGuide />, client)
      const button = screen.getByRole('button', {
        name: 'Copy ready-to-run curl',
      })
      if (expected) {
        await waitFor(() => expect(button).toBeEnabled())
        await user.click(button)
        await waitFor(() => expect(clipboard).toHaveBeenCalled())
        expect(clipboard.mock.calls[0][0]).toContain(JSON.stringify(expected))
      } else {
        expect(button).toBeDisabled()
        expect(reveal).not.toHaveBeenCalled()
      }
    }
  )
})
