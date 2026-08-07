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
import { after, afterEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

import type { AuthBundle } from '@/stores/auth-store'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/http-client')
const { useAuthStore } = await import('@/stores/auth-store')
const { agentSummaryQueryKey, useAgentSummary } =
  await import('../hooks/use-agent-summary')

const originalGet = api.get
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

function authBundle(userId: number, sid: string): AuthBundle {
  return {
    access_token: `token-${sid}`,
    token_type: 'Bearer',
    access_expires_at: Math.floor(Date.now() / 1000) + 600,
    user: { id: userId, username: `user-${userId}`, role: 1 },
    session: {
      sid,
      current: true,
      login_method: 'password',
      ip: '127.0.0.1',
      user_agent: 'test',
      created_at: 100,
      last_active_at: 100,
      expires_at: 1000,
    },
  }
}

function AgentStateProbe() {
  const summary = useAgentSummary()
  return <output data-state={summary.state}>{summary.state}</output>
}

async function flushQuery() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

afterEach(() => {
  api.get = originalGet
  useAuthStore.getState().auth.reset('idle')
  localStorage.clear()
  document.body.replaceChildren()
})

after(() => {
  domWindow.close()
})

describe('agent summary identity lifecycle', () => {
  test('discovers an agent on a fresh login without legacy localStorage user data', async () => {
    const requestedUrls: string[] = []
    api.get = (async (url: string) => {
      requestedUrls.push(url)
      return {
        status: 200,
        data: { ok: true, profile: { status: 'active' } },
      }
    }) as unknown as typeof api.get
    useAuthStore.getState().auth.setBundle(authBundle(51, 'fresh-session'))

    assert.equal(localStorage.getItem('user'), null)

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AgentStateProbe />
        </QueryClientProvider>
      )
    })
    await flushQuery()

    assert.deepEqual(requestedUrls, ['/agent/api/agent/summary'])
    assert.equal(container.querySelector('output')?.dataset.state, 'agent')

    await act(async () => root.unmount())
    queryClient.clear()
  })

  test('ignores a late response from the previous authenticated SID', async () => {
    let resolveOldRequest: ((value: unknown) => void) | undefined
    api.get = (async () => {
      const sid = useAuthStore.getState().auth.session?.sid
      if (sid === 'session-a') {
        return await new Promise((resolve) => {
          resolveOldRequest = resolve
        })
      }
      return {
        status: 403,
        data: {
          ok: false,
          code: 'AGENT_NOT_ENABLED',
          not_agent: true,
        },
      }
    }) as unknown as typeof api.get

    useAuthStore.getState().auth.setBundle(authBundle(10, 'session-a'))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AgentStateProbe />
        </QueryClientProvider>
      )
    })
    await flushQuery()

    await act(async () => {
      useAuthStore.getState().auth.setBundle(authBundle(11, 'session-b'))
    })
    await flushQuery()
    assert.equal(container.querySelector('output')?.dataset.state, 'none')

    await act(async () => {
      resolveOldRequest?.({
        status: 200,
        data: { ok: true, profile: { status: 'active' } },
      })
      await Promise.resolve()
    })
    assert.equal(container.querySelector('output')?.dataset.state, 'none')

    await act(async () => root.unmount())
    queryClient.clear()
  })

  test('keeps a confirmed agent entry visible when a background refetch fails', async () => {
    let requestCount = 0
    api.get = (async () => {
      requestCount += 1
      if (requestCount === 1) {
        return {
          status: 200,
          data: { ok: true, profile: { status: 'active' } },
        }
      }
      throw new Error('temporary upstream failure')
    }) as unknown as typeof api.get

    useAuthStore.getState().auth.setBundle(authBundle(77, 'stable-session'))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AgentStateProbe />
        </QueryClientProvider>
      )
    })
    await flushQuery()
    assert.equal(container.querySelector('output')?.dataset.state, 'agent')

    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: agentSummaryQueryKey(77, 'stable-session'),
        exact: true,
      })
    })
    await flushQuery()

    assert.equal(requestCount, 2)
    assert.equal(container.querySelector('output')?.dataset.state, 'agent')

    await act(async () => root.unmount())
    queryClient.clear()
  })
})
