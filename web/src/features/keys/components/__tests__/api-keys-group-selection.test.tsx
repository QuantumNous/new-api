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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { useAuthStore } = await import('@/stores/auth-store')
const { ApiKeysProvider } = await import('../api-keys-provider')
const { ApiKeysMutateDrawer } = await import('../api-keys-mutate-drawer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = {
  get: ApiMethod
  post: ApiMethod
  put: ApiMethod
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post
const originalPut = apiClient.put
let queryClient: InstanceType<typeof QueryClient> | null = null

const GROUPS = {
  default: { desc: 'Standard access', ratio: 1 },
  vip: { desc: 'Priority access', ratio: 2 },
}

function signIn(group: string | undefined) {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'tester',
    role: 1,
    group,
  })
}

function installApiFixtures(options: {
  submittedPayloads: Array<Record<string, unknown>>
  existingKey?: Record<string, unknown>
}) {
  apiClient.get = async (url) => {
    if (url === '/api/status') {
      return { data: { data: { default_use_auto_group: false } } }
    }
    if (url === '/api/user/models') {
      return { data: { success: true, data: [] } }
    }
    if (url === '/api/user/self/groups') {
      return { data: { success: true, data: GROUPS } }
    }
    if (url === '/api/token/auto-groups') {
      return { data: { success: true, data: { groups: [], max_count: 3 } } }
    }
    if (url.startsWith('/api/token/')) {
      return { data: { success: true, data: options.existingKey } }
    }
    throw new Error(`Unexpected GET ${url}`)
  }
  const record: ApiMethod = async (_url, data) => {
    options.submittedPayloads.push(data as Record<string, unknown>)
    return { data: { success: true, data: {} } }
  }
  apiClient.post = record
  apiClient.put = record
}

async function renderDrawer(currentRow?: Record<string, unknown>) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const freshAt = Date.now() + 60_000
  queryClient.setQueryData(
    ['status'],
    { default_use_auto_group: false },
    { updatedAt: freshAt }
  )
  queryClient.setQueryData(
    ['user-models'],
    { success: true, data: [] },
    { updatedAt: freshAt }
  )
  queryClient.setQueryData(
    ['user-groups'],
    { success: true, data: GROUPS },
    { updatedAt: freshAt }
  )
  queryClient.setQueryData(
    ['token-auto-groups'],
    { success: true, data: { groups: [], max_count: 3 } },
    { updatedAt: freshAt }
  )

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ApiKeysProvider>
          <ApiKeysMutateDrawer
            open
            onOpenChange={() => undefined}
            currentRow={currentRow as never}
          />
        </ApiKeysProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
  await waitFor(() => expect(findButton('Save changes')).toBeEnabled(), {
    timeout: 1500,
  })
}

function findButton(text: string): HTMLButtonElement {
  const button = screen
    .queryAllByRole<HTMLButtonElement>('button')
    .find((candidate) => candidate.textContent?.includes(text))
  if (!button) {
    throw new Error(`Expected button containing "${text}"`)
  }
  return button
}

function getGroupTrigger(): HTMLButtonElement {
  const label = [...document.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent?.trim() === 'Group'
  )
  const trigger = label
    ?.closest('[data-slot="form-item"]')
    ?.querySelector<HTMLButtonElement>('button[role="combobox"]')
  if (!trigger) {
    throw new Error('Expected the Group combobox')
  }
  return trigger
}

async function waitForSelectedGroup(group: string) {
  await waitFor(() =>
    expect(getGroupTrigger().textContent).toContain(group), {
    timeout: 1500,
  })
}

function setName(value: string) {
  const label = [...document.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent?.trim() === 'Name'
  )
  const input = label?.control as HTMLInputElement | null
  if (!input) {
    throw new Error('Expected the Name input')
  }
  fireEvent.input(input, { target: { value } })
}

afterEach(() => {
  apiClient.get = originalGet
  apiClient.post = originalPost
  apiClient.put = originalPut
  useAuthStore.getState().auth.setUser(null)
  localStorage.clear()
  queryClient?.clear()
  queryClient = null
})

describe('API key group selection', () => {
  test('preselects the own user group and submits it when creating a key', async () => {
    const submittedPayloads: Array<Record<string, unknown>> = []
    installApiFixtures({ submittedPayloads })
    signIn('vip')
    await renderDrawer()
    await waitForSelectedGroup('vip')

    setName('created')
    fireEvent.click(findButton('Save changes'))
    await waitFor(() => expect(submittedPayloads).toHaveLength(1))
    expect(submittedPayloads[0]?.group).toBe('vip')
  })

  test('preselects default when the own user group is not selectable', async () => {
    const submittedPayloads: Array<Record<string, unknown>> = []
    installApiFixtures({ submittedPayloads })
    signIn('svip')
    await renderDrawer()
    await waitForSelectedGroup('default')

    setName('created')
    fireEvent.click(findButton('Save changes'))
    await waitFor(() => expect(submittedPayloads).toHaveLength(1))
    expect(submittedPayloads[0]?.group).toBe('default')
  })

  test('pins the resolved group when saving a key stored without one', async () => {
    const submittedPayloads: Array<Record<string, unknown>> = []
    const existingKey = {
      id: 42,
      name: 'legacy',
      key: 'sk-legacy',
      status: 1,
      remain_quota: 0,
      used_quota: 0,
      unlimited_quota: true,
      expired_time: -1,
      created_time: 1,
      accessed_time: 0,
      group: '',
      auto_groups: null,
      cross_group_retry: false,
      model_limits_enabled: false,
      model_limits: '',
      allow_ips: '',
    }
    installApiFixtures({ submittedPayloads, existingKey })
    signIn('vip')
    await renderDrawer(existingKey)
    await waitForSelectedGroup('vip')

    fireEvent.click(findButton('Save changes'))
    await waitFor(() => expect(submittedPayloads).toHaveLength(1))
    expect(submittedPayloads[0]?.group).toBe('vip')
  })
})
