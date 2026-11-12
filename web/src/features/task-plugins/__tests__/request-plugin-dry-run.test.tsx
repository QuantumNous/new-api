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
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import type { TaskPluginOption } from '@/features/channels/api'
import { api } from '@/lib/api'

import { RequestPluginDryRunDialog } from '../components/request-plugin-dry-run-dialog'
import type { RequestPluginDryRunResult, RequestPluginInstance } from '../types'

vi.mock('@/lib/lobe-icon', () => ({ getLobeIcon: () => null }))

const instances: RequestPluginInstance[] = [
  {
    id: 'rp_aaaa1111',
    name: 'Block secrets',
    plugin: 'request-filter',
    enabled: true,
    global: true,
    groups: [],
    models: [],
    config: {},
  },
]
const plugins: TaskPluginOption[] = [
  {
    key: 'request-filter',
    name: 'Request filter',
    models: [],
    task: false,
    provider: false,
    transform: true,
  },
]

let client: QueryClient
afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
})

function renderDryRun(result: RequestPluginDryRunResult) {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true, data: result } })
  vi.spyOn(api, 'get').mockRejectedValue(new Error('no plugin icon'))
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RequestPluginDryRunDialog
        open
        onOpenChange={() => undefined}
        instances={instances}
        plugins={plugins}
        groups={['default', 'vip']}
      />
    </QueryClientProvider>
  )
  return { post, user: userEvent.setup() }
}

test('a dry run sends the sample request and shows the refusal with each step', async () => {
  const { post, user } = renderDryRun({
    rejected: {
      code: 'blocked.keyword',
      message: 'Contains a blocked word',
      instance: 'rp_aaaa1111',
    },
    failed: null,
    steps: [
      {
        instance: 'rp_aaaa1111',
        name: 'Block secrets',
        plugin: 'request-filter',
        stage: 'ingress',
        action: 'reject',
        effects: 0,
        findings: [{ rule: 'kw1', category: 'keyword', count: 2 }],
        duration_ms: 3,
      },
    ],
    body: {},
    headers: { set: {}, remove: [] },
  })
  const body = screen.getByRole('textbox', { name: 'Request body' })
  expect((body as HTMLTextAreaElement).value).toContain('alice@example.com')
  await user.type(screen.getByRole('combobox', { name: 'Group' }), 'vip')
  fireEvent.change(screen.getByRole('textbox', { name: 'Channel ID' }), {
    target: { value: '12' },
  })

  await user.click(screen.getByRole('button', { name: 'Run' }))

  expect(
    await screen.findByText(
      'Refused by Block secrets: Contains a blocked word (code: blocked.keyword)'
    )
  ).toBeVisible()
  expect(post).toHaveBeenCalledWith(
    '/api/request_plugin/dry_run',
    {
      format: 'openai',
      path: '/v1/chat/completions',
      model: 'gpt-4.1-mini',
      group: 'vip',
      channel_id: 12,
      body: JSON.parse((body as HTMLTextAreaElement).value),
    },
    expect.anything()
  )
  const step = within(screen.getByRole('table', { name: 'Steps' }))
    .getAllByRole('row')
    .at(1)
  expect(step).toHaveTextContent('Block secrets')
  expect(step).toHaveTextContent('Request filter')
  expect(step).toHaveTextContent('Before the request is read')
  expect(step).toHaveTextContent('Refused')
  expect(step).toHaveTextContent('kw1 (keyword) × 2')
  expect(step).toHaveTextContent('3 ms')
})

test('a passing dry run shows the body changes, header changes and reasoning effort', async () => {
  const { user } = renderDryRun({
    rejected: null,
    failed: null,
    steps: [],
    body: {
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'My email is [email].' }],
    },
    headers: { set: { 'X-Policy': 'redacted' }, remove: ['X-Debug'] },
    reasoning_effort: 'high',
  })

  await user.click(screen.getByRole('button', { name: 'Run' }))

  expect(
    await screen.findByText('The request passed every instance.')
  ).toBeVisible()
  const diff = screen.getByLabelText('Request body changes')
  expect(diff).toHaveTextContent('+ "content": "My email is [email]."')
  expect(diff).toHaveTextContent('- "role": "system",')
  expect(screen.getByText('Set X-Policy: redacted')).toBeVisible()
  expect(screen.getByText('Remove X-Debug')).toBeVisible()
  expect(screen.getByText('Reasoning effort: high')).toBeVisible()
})

test('a dry run shows what users would see about the request in their logs', async () => {
  const { user } = renderDryRun({
    rejected: null,
    failed: null,
    steps: [],
    body: {},
    record: [
      {
        plugin: 'request-redact',
        name: { en: 'Request redaction' },
        stage: 'ingress',
        findings: [{ category: 'email', count: 1 }],
      },
    ],
  })

  await user.click(screen.getByRole('button', { name: 'Run' }))

  expect(
    await screen.findByRole('heading', { name: 'What users see in their logs' })
  ).toBeVisible()
  expect(screen.getByText('Request redaction')).toBeVisible()
  expect(screen.getByText('Email address × 1')).toBeVisible()
})

test('a dry run with nothing to record says users see nothing about it', async () => {
  const { user } = renderDryRun({
    rejected: null,
    failed: null,
    steps: [],
    body: {},
    record: [],
  })

  await user.click(screen.getByRole('button', { name: 'Run' }))

  expect(
    await screen.findByText('Nothing about this request is shown in user logs.')
  ).toBeVisible()
})

test('a body that is not a JSON object is reported before anything is sent', async () => {
  const { post, user } = renderDryRun({
    rejected: null,
    failed: null,
    steps: [],
    body: {},
  })

  fireEvent.input(screen.getByRole('textbox', { name: 'Request body' }), {
    target: { value: '[1, 2]' },
  })
  await user.click(screen.getByRole('button', { name: 'Run' }))

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Request body must be a JSON object.'
  )
  expect(post).not.toHaveBeenCalled()
})
