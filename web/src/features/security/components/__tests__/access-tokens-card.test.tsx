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
  act,
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
  AccessTokenItem,
  AccessTokenList,
} from '../../api'
import { AccessTokensCard } from '../access-tokens-card'

const NOW = Math.floor(Date.now() / 1000)

const catalog: AccessTokenCatalog = {
  groups: [
    {
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
            {
              action: 'write',
              label_key: 'Edit',
              description_key: 'Edit API keys',
            },
          ],
        },
      ],
    },
  ],
  max_tokens: 20,
  default_expiry_days: 30,
}

function tokenItem(overrides: Partial<AccessTokenItem>): AccessTokenItem {
  return {
    id: 1,
    name: 'deploy script',
    token_ref: 'a'.repeat(64),
    token_hint: 'Ab12',
    scopes: ['tokens:read'],
    expires_at: NOW + 30 * 24 * 60 * 60,
    last_used_at: 0,
    last_used_ip: '',
    created_at: NOW - 60,
    ...overrides,
  }
}

let list: AccessTokenList
let listFailure: Error | null
let catalogGate: Promise<void>
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

function verifyCalls() {
  return vi
    .mocked(api.post)
    .mock.calls.filter(([url]) => url === '/api/verify')
    .map(([, data]) => data)
}

beforeEach(() => {
  proofCount = 0
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 100 })
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  list = { items: [], legacy: null }
  listFailure = null
  catalogGate = Promise.resolve()
  vi.spyOn(api, 'get').mockImplementation(async (url, config) => {
    if (url === '/api/audit/self') {
      return { data: { success: true, data: { items: [], total: 0 } } }
    }
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
      await catalogGate
      return { data: { success: true, data: catalog } }
    }
    if (url === '/api/user/access_tokens') {
      if (listFailure) throw listFailure
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
  vi.spyOn(api, 'delete').mockResolvedValue({
    data: { success: true, data: null },
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

async function openEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Open menu' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
  return screen.findByRole('dialog', { name: 'Edit access token' })
}

function permission(container: HTMLElement, action: string) {
  return within(
    within(container).getByRole('group', { name: 'API keys' })
  ).getByRole('button', { name: action })
}

function mockPatch(item: AccessTokenItem) {
  return vi.spyOn(api, 'patch').mockResolvedValue({
    data: { success: true, data: item },
  })
}

async function openRevoke(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Open menu' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Revoke' }))
  const confirmation = await screen.findByRole('alertdialog')
  await user.click(within(confirmation).getByRole('button', { name: 'Revoke' }))
}

describe('access tokens card', () => {
  it('lists tokens with their permissions and expiry state', async () => {
    list = {
      items: [
        tokenItem({ id: 1, name: 'nightly export', expires_at: 0 }),
        tokenItem({
          id: 2,
          name: 'old script',
          expires_at: NOW - 60,
          scopes: ['tokens:read', 'retired:write'],
        }),
      ],
      legacy: null,
    }
    renderCard()
    expect(await screen.findByText('nightly export')).toBeVisible()
    expect(screen.getByText('Never expires')).toBeVisible()
    expect(screen.getByText('Expired')).toBeVisible()
    expect(screen.getAllByText('API keys')).toHaveLength(2)
    // A resource the catalog no longer offers is counted, never shown by key.
    expect(screen.getByText('+1')).toBeVisible()
    expect(screen.queryByText(/retired/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Never used')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Create access token' })
    ).toBeEnabled()
  })

  it('disables Edit while the permission catalog is loading or failed to load', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    let failCatalog!: (error: Error) => void
    catalogGate = new Promise((_, reject) => {
      failCatalog = reject
    })
    const client = renderCard()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    const edit = await screen.findByRole('menuitem', { name: 'Edit' })
    expect(edit).toHaveAttribute('aria-disabled', 'true')
    failCatalog(new Error('offline'))
    await waitFor(() =>
      expect(
        client.getQueryState(['security', 'access-tokens', 'catalog', 1])
          ?.status
      ).toBe('error')
    )
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('shows an empty state when there are no tokens', async () => {
    renderCard()
    expect(await screen.findByText('No access tokens')).toBeVisible()
  })

  it('shows the legacy stop date and offers revocation and records for it', async () => {
    list = {
      items: [],
      legacy: {
        token_hint: 'Zz99',
        token_ref: 'b'.repeat(64),
        created_at: null,
        last_used_at: null,
        last_used_ip: '',
        retire_at: NOW + 10 * 24 * 60 * 60,
      },
    }
    renderCard()
    expect(await screen.findByText('Legacy token')).toBeVisible()
    expect(
      screen.getByText(/^The legacy token stops working on .+\. Create a new/)
    ).toBeVisible()
    expect(screen.getByText('…Zz99')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Regenerate|Generate/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeVisible()
    const [, legacyRecords] = screen.getAllByRole('button', {
      name: 'Access records',
    })
    await userEvent.click(legacyRecords)
    await screen.findByRole('dialog', { name: 'Access records' })
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/audit/self', {
        params: expect.objectContaining({
          category: 'access_token',
          token_ref: 'b'.repeat(64),
        }),
      })
    )
  })

  it('disables creation at the token limit', async () => {
    list = {
      items: Array.from({ length: catalog.max_tokens }, (_, index) =>
        tokenItem({ id: index + 1, name: `token ${index + 1}` })
      ),
      legacy: null,
    }
    renderCard()
    expect(await screen.findByText('token 20')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Create access token' })
    ).toBeDisabled()
    expect(
      screen.getByText('You can create up to 20 access tokens')
    ).toBeVisible()
  })

  it('load failures offer retry without claiming there are no tokens', async () => {
    listFailure = new Error('offline')
    renderCard()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load access tokens'
    )
    expect(screen.queryByText('No access tokens')).not.toBeInTheDocument()
    listFailure = null
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No access tokens')).toBeVisible()
  })

  it('revokes a token after confirmation with a proof bound to that token', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    renderCard()
    const user = userEvent.setup()
    await openRevoke(user)
    await verifyPassword(user)
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(
        '/api/user/access_tokens/7',
        expect.objectContaining({
          headers: { 'X-Security-Proof': 'one-use-proof-1' },
          singleUseAuthorization: true,
        })
      )
    )
    expect(verifyCalls()).toEqual([
      expect.objectContaining({
        scope: 'access_token.revoke',
        context: { token_id: 7 },
      }),
    ])
    expect(await screen.findByText('Access token revoked')).toBeVisible()
  })

  it('does not revoke when identity verification is cancelled', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    renderCard()
    const user = userEvent.setup()
    await openRevoke(user)
    await screen.findByLabelText('Password', { selector: 'input' })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Password', { selector: 'input' })
      ).not.toBeInTheDocument()
    )
    expect(api.delete).not.toHaveBeenCalled()
    expect(verifyCalls()).toHaveLength(0)
    expect(screen.getByText('deploy script')).toBeVisible()
  })

  it('revokes the legacy token with a proof bound to the legacy token', async () => {
    list = {
      items: [],
      legacy: {
        token_hint: 'Zz99',
        token_ref: 'b'.repeat(64),
        created_at: NOW - 3600,
        last_used_at: NOW - 60,
        last_used_ip: '203.0.113.9',
        retire_at: NOW + 10 * 24 * 60 * 60,
      },
    }
    renderCard()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Revoke' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Revoke',
      })
    )
    await verifyPassword(user)
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(
        '/api/user/access_tokens/legacy',
        expect.objectContaining({
          headers: { 'X-Security-Proof': 'one-use-proof-1' },
          singleUseAuthorization: true,
        })
      )
    )
    expect(verifyCalls()).toEqual([
      expect.objectContaining({
        scope: 'access_token.revoke',
        context: { legacy: true },
      }),
    ])
  })

  it('aborts a revocation when the active account changes', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    let complete!: (value: { data: { success: boolean; data: null } }) => void
    const pending = new Promise<{ data: { success: boolean; data: null } }>(
      (resolve) => {
        complete = resolve
      }
    )
    let signal: { readonly aborted: boolean } | undefined
    vi.mocked(api.delete).mockImplementation(async (_url, config) => {
      signal = config?.signal
      return pending
    })
    renderCard()
    const user = userEvent.setup()
    await openRevoke(user)
    await verifyPassword(user)
    await waitFor(() => expect(signal).toBeDefined())
    await act(async () => {
      useAuthStore
        .getState()
        .auth.setUser({ id: 2, username: 'other-user', role: 100 })
    })
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      complete({ data: { success: true, data: null } })
      await pending
    })
    expect(screen.queryByText('Access token revoked')).not.toBeInTheDocument()
  })

  it('renames a token without identity verification and blocks a second save while it runs', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    let complete!: () => void
    const saved = new Promise<{
      data: { success: boolean; data: AccessTokenItem }
    }>((resolve) => {
      complete = () =>
        resolve({
          data: { success: true, data: tokenItem({ id: 7, name: 'renamed' }) },
        })
    })
    const patch = vi.spyOn(api, 'patch').mockReturnValue(saved)
    renderCard()
    const user = userEvent.setup()
    const dialog = await openEdit(user)
    const input = within(dialog).getByLabelText('Token name')
    expect(input).toHaveValue('deploy script')
    await user.clear(input)
    await user.type(input, '  renamed  ')
    const save = within(dialog).getByRole('button', { name: 'Save' })
    await user.click(save)
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/user/access_tokens/7',
        { name: 'renamed' },
        expect.anything()
      )
    )
    await waitFor(() => expect(save).toBeDisabled())
    expect(verifyCalls()).toHaveLength(0)
    complete()
    expect(await screen.findByText('Saved successfully')).toBeVisible()
    expect(patch).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Edit access token' })
      ).not.toBeInTheDocument()
    )
  })

  it('saves a permission change with a proof bound to the token and the new grant', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    const scopes = ['tokens:read', 'tokens:write']
    const patch = mockPatch(tokenItem({ id: 7, scopes }))
    renderCard()
    const user = userEvent.setup()
    const dialog = await openEdit(user)
    expect(
      within(dialog).getByText(
        'Saving permission changes requires security verification'
      )
    ).toBeVisible()
    expect(permission(dialog, 'View')).toHaveAttribute('aria-pressed', 'true')
    await user.click(permission(dialog, 'Edit'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await verifyPassword(user)
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/user/access_tokens/7',
        { name: 'deploy script', scopes },
        expect.objectContaining({
          headers: { 'X-Security-Proof': 'one-use-proof-1' },
          singleUseAuthorization: true,
        })
      )
    )
    expect(verifyCalls()).toEqual([
      expect.objectContaining({
        scope: 'access_token.update',
        context: { token_id: 7, scopes },
      }),
    ])
    expect(await screen.findByText('Saved successfully')).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Edit access token' })
      ).not.toBeInTheDocument()
    )
  })

  it('keeps the edited permissions and saves nothing when verification is cancelled', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    const patch = mockPatch(tokenItem({ id: 7 }))
    renderCard()
    const user = userEvent.setup()
    const dialog = await openEdit(user)
    await user.click(permission(dialog, 'Edit'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await screen.findByLabelText('Password', { selector: 'input' })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    const restored = await screen.findByRole('dialog', {
      name: 'Edit access token',
    })
    expect(permission(restored, 'Edit')).toHaveAttribute('aria-pressed', 'true')
    expect(patch).not.toHaveBeenCalled()
    expect(verifyCalls()).toHaveLength(0)
  })

  it('keeps permissions the catalog no longer offers on a rename and leaves them out of a new grant', async () => {
    list = {
      items: [tokenItem({ id: 7, scopes: ['retired:write'] })],
      legacy: null,
    }
    const patch = mockPatch(tokenItem({ id: 7, name: 'renamed' }))
    renderCard()
    const user = userEvent.setup()
    const dialog = await openEdit(user)
    expect(permission(dialog, 'View')).toHaveAttribute('aria-pressed', 'false')
    const input = within(dialog).getByLabelText('Token name')
    await user.clear(input)
    await user.type(input, 'renamed')
    list = {
      items: [tokenItem({ id: 7, name: 'renamed', scopes: ['retired:write'] })],
      legacy: null,
    }
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/user/access_tokens/7',
        { name: 'renamed' },
        expect.anything()
      )
    )
    expect(verifyCalls()).toHaveLength(0)

    expect(await screen.findByText('renamed')).toBeVisible()
    const regrant = await openEdit(user)
    await user.click(permission(regrant, 'View'))
    await user.click(within(regrant).getByRole('button', { name: 'Save' }))
    await verifyPassword(user)
    await waitFor(() =>
      expect(patch).toHaveBeenLastCalledWith(
        '/api/user/access_tokens/7',
        { name: 'renamed', scopes: ['tokens:read'] },
        expect.objectContaining({ singleUseAuthorization: true })
      )
    )
    expect(verifyCalls()).toEqual([
      expect.objectContaining({
        scope: 'access_token.update',
        context: { token_id: 7, scopes: ['tokens:read'] },
      }),
    ])
  })

  it('does not save a change that removes every permission', async () => {
    list = { items: [tokenItem({ id: 7 })], legacy: null }
    const patch = mockPatch(tokenItem({ id: 7 }))
    renderCard()
    const user = userEvent.setup()
    const dialog = await openEdit(user)
    await user.click(permission(dialog, 'View'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('Select at least one permission')
    ).toBeVisible()
    expect(patch).not.toHaveBeenCalled()
    expect(verifyCalls()).toHaveLength(0)
  })

  it('opens access records for every token or for one token', async () => {
    list = {
      items: [tokenItem({ id: 7, token_ref: 'c'.repeat(64) })],
      legacy: null,
    }
    renderCard()
    const user = userEvent.setup()
    const trigger = await screen.findByRole('button', {
      name: 'Access records',
    })
    trigger.focus()
    await user.keyboard('{Enter}')
    const sheet = await screen.findByRole('dialog', { name: 'Access records' })
    expect(sheet).toHaveClass('w-full', 'sm:max-w-5xl')
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/audit/self', {
        params: expect.objectContaining({ category: 'access_token' }),
      })
    )
    expect(api.get).not.toHaveBeenCalledWith('/api/audit/self', {
      params: expect.objectContaining({ token_ref: expect.anything() }),
    })
    expect(api.get).not.toHaveBeenCalledWith('/api/audit', expect.anything())
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(trigger).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Access records' })
    )
    const tokenSheet = await screen.findByRole('dialog', {
      name: 'Access records',
    })
    expect(
      within(tokenSheet).getByRole('combobox', { name: 'Token scope' })
    ).toHaveValue('Current token')
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/api/audit/self', {
        params: expect.objectContaining({
          category: 'access_token',
          token_ref: 'c'.repeat(64),
        }),
      })
    )
  })
})
