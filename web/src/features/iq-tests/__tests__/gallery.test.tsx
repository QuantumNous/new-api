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
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { IQTestsPage } from '..'
import {
  artifactRevision,
  type IQArtifact,
  type IQConfig,
  type IQResult,
  type IQResults,
} from '../types'

const originalAdapter = api.defaults.adapter
let client: QueryClient
let requests: string[]
let results: IQResults
let staleArtifact = false
const config: IQConfig = {
  version: 2,
  prompt: 'Draw a pelican.',
  targets: [{ group: 'public', models: ['model-0'] }],
  enabled: false,
  schedule_mode: 'interval',
  interval_hours: 24,
  daily_time: '09:00',
  timezone: 'Asia/Shanghai',
  next_run_at: 0,
  updated_at: 1,
  updated_by: 1,
}

function login(id = 1, role = 1): void {
  useAuthStore.getState().auth.setBundle({
    access_token: 'fixture-token',
    token_type: 'Bearer',
    access_expires_at: 4_000_000_000,
    user: { id, username: `viewer-${id}`, role, group: 'public' },
    session: {
      sid: `session-${id}`,
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 4_000_000_000,
    },
  })
}

function latest(index: number): IQResult {
  return {
    id: `pair-${index}`,
    group: 'public',
    model: `model-${index}`,
    task_id: 'previous-run',
    config_version: 2,
    status: 'success',
    started_at: 1_794_211_200,
    completed_at: 1_794_211_212,
    duration_ms: 12_000,
    artifact_kind: 'html',
    error_code: '',
    error_message: '',
  }
}

class VisibilityObserver {
  static current: VisibilityObserver
  elements = new Set<Element>()
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    VisibilityObserver.current = this
  }
  observe(element: Element) {
    this.elements.add(element)
  }
  unobserve(element: Element) {
    this.elements.delete(element)
  }
  disconnect() {
    this.elements.clear()
  }
  show(visible: Element[]) {
    this.callback(
      [...this.elements].map(
        (target) =>
          ({
            target,
            isIntersecting: visible.includes(target),
          }) as IntersectionObserverEntry
      ),
      this as unknown as IntersectionObserver
    )
  }
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  requests = []
  staleArtifact = false
  results = {
    groups: [
      {
        group: 'public',
        models: Array.from({ length: 5 }, (_, index) => ({
          model: `model-${index}`,
          latest: latest(index),
          progress: {
            status: 'running',
            started_at: 1_794_297_600,
            completed_at: 0,
          },
        })),
      },
    ],
    active_run: {
      task_id: 'current-run',
      status: 'running',
      config_version: 3,
      created_at: 1_794_297_595,
      total: 5,
      completed: 0,
      running: 2,
      pending: 3,
    },
    next_run_at: 0,
    schedule_enabled: false,
    timezone: 'Asia/Shanghai',
  }
  vi.stubGlobal('IntersectionObserver', VisibilityObserver)
  login()
  const adapter: AxiosAdapter = async (request) => {
    requests.push(request.url ?? '')
    let data: unknown
    if (request.url === '/api/iq-tests/results') data = results
    else if (request.url === '/api/iq-tests/config') data = config
    else if (request.url === '/api/iq-tests/targets') {
      data = [{ group: 'public', models: ['model-0', 'model-1'] }]
    } else if (request.url?.startsWith('/api/iq-tests/results/')) {
      const id = request.url.split('/').at(-1)
      const result = results.groups
        .flatMap((group) => group.models)
        .find((card) => card.latest?.id === id)?.latest
      if (!result) throw new Error('Missing fixture result')
      data = {
        ...result,
        artifact_kind: 'html',
        task_id: staleArtifact ? 'newer-run' : result.task_id,
        artifact:
          '<html><body><canvas></canvas><script>window.art = true</script></body></html>',
      } satisfies IQArtifact & IQResult
    } else throw new Error(`Unexpected request: ${request.url}`)
    return {
      data: { success: true, message: '', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: request,
    }
  }
  api.defaults.adapter = adapter
})

afterEach(() => {
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  vi.unstubAllGlobals()
})

function mount() {
  return render(
    <QueryClientProvider client={client}>
      <IQTestsPage />
    </QueryClientProvider>
  )
}

async function showCards(indices: number[]) {
  const observer = VisibilityObserver.current
  await act(async () =>
    observer.show(indices.map((index) => [...observer.elements][index]))
  )
}

describe('authenticated IQ gallery', () => {
  it('keeps prior results dated during a run and exposes no member admin actions or eager artifacts', async () => {
    mount()
    await screen.findByRole('heading', { name: 'public' })
    expect(screen.getByRole('status')).toHaveTextContent('0 / 5 completed')
    expect(screen.getAllByText(/Latest result/)).toHaveLength(5)
    expect(screen.getAllByText(/Current run/)).toHaveLength(6)
    expect(
      screen.queryByRole('button', { name: 'Run now' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'IQ test settings' })
    ).not.toBeInTheDocument()
    expect(requests).toEqual(['/api/iq-tests/results'])
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('caps live cards, unmounts offscreen and closed frames, and clears all previews on account changes', async () => {
    const user = userEvent.setup()
    mount()
    await screen.findByRole('heading', { name: 'public' })
    await showCards([0, 1, 2, 3, 4])
    await waitFor(() =>
      expect(document.querySelectorAll('iframe')).toHaveLength(4)
    )
    const frame = document.querySelector('iframe')
    if (!frame) throw new Error('Expected an isolated preview')
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(frame.srcdoc).not.toContain('fixture-token')
    await showCards([])
    expect(document.querySelector('iframe')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Preview model-0' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(
        within(dialog).getByTitle('Artwork by model-0')
      ).toBeInTheDocument()
    )
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(document.querySelector('iframe')).toBeNull()
    results = { ...results, groups: [], active_run: null }
    await act(async () => login(2))
    await screen.findByText('No IQ results available')
    expect(screen.queryByText('model-0')).not.toBeInTheDocument()
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => !JSON.stringify(query.queryKey).includes('session-1'))
    ).toBe(true)
  })

  it('rejects a newer artifact returned under a stable pair ID instead of showing it with the old time', async () => {
    staleArtifact = true
    mount()
    await screen.findByRole('heading', { name: 'public' })
    await showCards([0])
    await screen.findByText('Preview unavailable. Refresh the gallery.')
    expect(document.querySelector('iframe')).toBeNull()
    expect(artifactRevision(latest(0))).toContain('previous-run')
  })

  it('shows settings and manual execution only to authorized administrators', async () => {
    login(1, 100)
    results = { ...results, groups: [], active_run: null }
    mount()
    await screen.findByText('No IQ results available')
    expect(screen.getByRole('button', { name: 'Run now' })).toBeEnabled()
    await userEvent.click(
      screen.getByRole('button', { name: 'IQ test settings' })
    )
    await screen.findByLabelText('Test prompt')
    expect(requests).toContain('/api/iq-tests/config')
    expect(requests).toContain('/api/iq-tests/targets')
    expect(screen.getByLabelText('Test prompt')).toHaveValue('Draw a pelican.')
  })
})
