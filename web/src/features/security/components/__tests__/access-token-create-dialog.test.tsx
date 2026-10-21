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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster, toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import type {
  AccessTokenCatalog,
  AccessTokenInput,
  AccessTokenList,
} from '../../api'
import { AccessTokensCard } from '../access-tokens-card'

const personalGroup: AccessTokenCatalog['groups'][number] = {
  group: 'personal',
  resources: [
    {
      resource: 'tokens',
      label_key: 'API keys',
      actions: [
        {
          action: 'read',
          label_key: 'View',
          description_key: 'View API keys',
        },
      ],
    },
  ],
}
const adminGroup: AccessTokenCatalog['groups'][number] = {
  group: 'admin',
  resources: [
    {
      resource: 'channel',
      label_key: 'Channels',
      actions: [
        {
          action: 'read',
          label_key: 'Read',
          description_key: 'View channels',
        },
      ],
    },
  ],
}

let catalog: AccessTokenCatalog
let list: AccessTokenList
let proofCount: number

function passwordProof(scope: string) {
  proofCount += 1
  return {
    data: {
      success: true,
      data: {
        proof_token: `one-use-proof-${proofCount}`,
        scope,
        method: 'password',
        expires_at: Math.floor(Date.now() / 1000) + 60,
      },
    },
  }
}

async function verifyPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByLabelText('Password', { selector: 'input' }),
    'current-password'
  )
  await user.click(screen.getByRole('button', { name: 'Verify' }))
}

function permission(container: HTMLElement, resource: string, action: string) {
  return within(
    within(container).getByRole('group', { name: resource })
  ).getByRole('button', { name: action })
}

function postCalls(url: string) {
  return vi.mocked(api.post).mock.calls.filter(([called]) => called === url)
}

beforeEach(() => {
  proofCount = 0
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 100 })
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  catalog = {
    groups: [personalGroup, adminGroup],
    max_tokens: 20,
    default_expiry_days: 30,
  }
  list = { items: [], legacy: null }
  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url === '/api/verify/methods') {
      return {
        data: {
          success: true,
          data: {
            scope: config?.params?.scope,
            methods: [{ method: 'password', available: true }],
            oauth_providers: [],
            password_encryption_enabled: false,
          },
        },
      }
    }
    if (url === '/api/user/access_tokens/catalog') {
      return { data: { success: true, data: catalog } }
    }
    if (url === '/api/user/access_tokens') {
      return { data: { success: true, data: list } }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  vi.spyOn(api, 'post').mockImplementation(async (url, data) => {
    if (url === '/api/verify') {
      return passwordProof((data as { scope: string }).scope)
    }
    throw new Error(`Unexpected POST ${url}`)
  })
})
afterEach(() => {
  cleanup()
  useAuthStore.getState().auth.reset()
  toast.dismiss()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <AccessTokensCard />
      <Toaster />
    </QueryClientProvider>
  )
  return client
}

async function openCreate(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole('button', {
    name: 'Create access token',
  })
  await waitFor(() => expect(trigger).toBeEnabled())
  await user.click(trigger)
  return screen.findByRole('dialog', { name: 'Create access token' })
}

describe('create access token dialog', () => {
  it('requires at least one permission before asking for verification', async () => {
    renderCard()
    const user = userEvent.setup()
    const dialog = await openCreate(user)
    await user.type(within(dialog).getByLabelText('Token name'), 'ci')
    await user.click(
      within(dialog).getByRole('button', { name: 'Create access token' })
    )
    expect(
      await within(dialog).findByText('Select at least one permission')
    ).toBeVisible()
    expect(api.post).not.toHaveBeenCalled()
    expect(
      screen.queryByLabelText('Password', { selector: 'input' })
    ).not.toBeInTheDocument()
  })

  it('shows the admin group only when the catalog offers it', async () => {
    renderCard()
    const user = userEvent.setup()
    const dialog = await openCreate(user)
    expect(
      within(dialog).getByRole('region', { name: 'Personal' })
    ).toBeVisible()
    expect(
      within(dialog).getByRole('region', { name: 'Administration' })
    ).toBeVisible()
    cleanup()

    catalog = {
      ...catalog,
      groups: [personalGroup, { ...adminGroup, resources: [] }],
    }
    renderCard()
    const restricted = await openCreate(userEvent.setup())
    expect(
      within(restricted).getByRole('region', { name: 'Personal' })
    ).toBeVisible()
    expect(
      within(restricted).queryByRole('region', { name: 'Administration' })
    ).not.toBeInTheDocument()
    expect(
      within(restricted).queryByRole('group', { name: 'Channels' })
    ).not.toBeInTheDocument()
  })

  it('defaults to a 30-day expiry and binds the proof to the requested grant', async () => {
    vi.mocked(api.post).mockImplementation(async (url, data) => {
      if (url === '/api/verify') {
        return passwordProof((data as { scope: string }).scope)
      }
      return {
        data: {
          success: true,
          data: { token: 'nap_private-plaintext', item: {} },
        },
      }
    })
    renderCard()
    const user = userEvent.setup()
    const dialog = await openCreate(user)
    await user.type(within(dialog).getByLabelText('Token name'), '  ci  ')
    await user.click(permission(dialog, 'Channels', 'Read'))
    await user.click(permission(dialog, 'API keys', 'View'))
    const before = Math.floor(Date.now() / 1000)
    await user.click(
      within(dialog).getByRole('button', { name: 'Create access token' })
    )
    await verifyPassword(user)
    await waitFor(() =>
      expect(postCalls('/api/user/access_tokens')).toHaveLength(1)
    )
    const [[, body]] = postCalls('/api/user/access_tokens')
    const input = body as AccessTokenInput
    expect(input.name).toBe('ci')
    expect(input.scopes).toEqual(['channel:read', 'tokens:read'])
    const thirtyDays = 30 * 24 * 60 * 60
    expect(input.expires_at).toBeGreaterThanOrEqual(before + thirtyDays)
    expect(input.expires_at).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000) + thirtyDays
    )
    const [[, verifyBody]] = postCalls('/api/verify')
    expect(verifyBody).toEqual(
      expect.objectContaining({
        scope: 'access_token.generate',
        context: { scopes: input.scopes, expires_at: input.expires_at },
      })
    )
  })

  it('warns about tokens that never expire and shows the plaintext only once', async () => {
    const token = 'nap_one-time-private-token'
    vi.mocked(api.post).mockImplementation(async (url, data) => {
      if (url === '/api/verify') {
        return passwordProof((data as { scope: string }).scope)
      }
      return {
        data: {
          success: true,
          data: {
            token,
            item: {
              id: 9,
              name: 'nightly',
              token_ref: 'd'.repeat(64),
              token_hint: 'oken',
              scopes: ['tokens:read'],
              expires_at: 0,
              last_used_at: 0,
              last_used_ip: '',
              created_at: Math.floor(Date.now() / 1000),
            },
          },
        },
      }
    })
    const client = renderCard()
    const user = userEvent.setup()
    const dialog = await openCreate(user)
    const warning =
      'A token that never expires stays valid until you revoke it. Set an expiration date when possible.'
    expect(within(dialog).queryByText(warning)).not.toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Token name'), 'nightly')
    await user.click(
      within(dialog).getByRole('button', { name: 'Never expires' })
    )
    expect(within(dialog).getByText(warning)).toBeVisible()
    await user.click(permission(dialog, 'API keys', 'View'))
    await user.click(
      within(dialog).getByRole('button', { name: 'Create access token' })
    )
    await verifyPassword(user)

    const shown = await screen.findByRole('dialog', { name: 'Access tokens' })
    expect(within(shown).getByLabelText('Token')).toHaveValue(token)
    expect(
      screen.queryByRole('dialog', { name: 'Create access token' })
    ).not.toBeInTheDocument()
    const [[, verifyBody]] = postCalls('/api/verify')
    expect(verifyBody).toEqual(
      expect.objectContaining({
        scope: 'access_token.generate',
        context: { scopes: ['tokens:read'], expires_at: 0 },
      })
    )
    expect(api.post).toHaveBeenCalledWith(
      '/api/user/access_tokens',
      { name: 'nightly', scopes: ['tokens:read'], expires_at: 0 },
      expect.objectContaining({
        headers: { 'X-Security-Proof': 'one-use-proof-1' },
        singleUseAuthorization: true,
      })
    )

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument()
    )
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((entry) => entry.state.data)
      )
    ).not.toContain(token)
    expect(JSON.stringify(client.getMutationCache().getAll())).not.toContain(
      'one-use-proof-1'
    )
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((entry) => entry.state.data)
      )
    ).not.toContain(token)
  })

  it('selects and clears one group at a time and collapses it', async () => {
    catalog = {
      ...catalog,
      groups: [
        {
          group: 'personal',
          resources: [
            {
              ...personalGroup.resources[0],
              actions: [
                ...personalGroup.resources[0].actions,
                {
                  action: 'write',
                  label_key: 'Edit',
                  description_key: 'Edit API keys',
                },
              ],
            },
          ],
        },
        adminGroup,
      ],
    }
    renderCard()
    const user = userEvent.setup()
    const dialog = await openCreate(user)
    const personal = within(dialog).getByRole('region', { name: 'Personal' })
    const view = permission(personal, 'API keys', 'View')
    const edit = permission(personal, 'API keys', 'Edit')
    expect(view).toHaveAccessibleDescription('View API keys')
    expect(view).toHaveAttribute('aria-pressed', 'false')
    await user.click(view)
    expect(view).toHaveAttribute('aria-pressed', 'true')
    expect(within(personal).getByText('Selected 1 / 2')).toBeVisible()

    await user.click(
      within(personal).getByRole('button', { name: 'Select all' })
    )
    expect(edit).toHaveAttribute('aria-pressed', 'true')
    expect(within(personal).getByText('Selected 2 / 2')).toBeVisible()
    expect(permission(dialog, 'Channels', 'Read')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await user.click(within(personal).getByRole('button', { name: 'Clear' }))
    expect(view).toHaveAttribute('aria-pressed', 'false')
    expect(edit).toHaveAttribute('aria-pressed', 'false')

    const header = within(personal).getByRole('button', { name: /^Personal/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() =>
      expect(
        within(personal).queryByRole('group', { name: 'API keys' })
      ).not.toBeInTheDocument()
    )
  })

  it('keeps the form and sends nothing when verification is cancelled', async () => {
    renderCard()
    const user = userEvent.setup()
    const dialog = await openCreate(user)
    await user.type(within(dialog).getByLabelText('Token name'), 'ci')
    await user.click(permission(dialog, 'API keys', 'View'))
    await user.click(
      within(dialog).getByRole('button', { name: 'Create access token' })
    )
    await screen.findByLabelText('Password', { selector: 'input' })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    const restored = await screen.findByRole('dialog', {
      name: 'Create access token',
    })
    expect(within(restored).getByLabelText('Token name')).toHaveValue('ci')
    expect(postCalls('/api/user/access_tokens')).toHaveLength(0)
    expect(postCalls('/api/verify')).toHaveLength(0)
  })
})
