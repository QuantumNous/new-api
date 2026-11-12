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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { RelayDumpSection } from '../relay-dump-section'

const defaults = {
  'relay_dump_setting.enabled': true,
  'relay_dump_setting.mode': 'error',
  'relay_dump_setting.output': 'file',
  'relay_dump_setting.directory': 'relay-dump',
  'relay_dump_setting.max_body_kb': 64,
  'relay_dump_setting.max_files': 500,
  'relay_dump_setting.redact_headers': true,
  'relay_dump_setting.redact_list': ['X-Old-Secret'],
}

const listEntry = {
  id: '1730000000000-req-1',
  request_id: 'req-1',
  created_at: 1730000000000,
  duration_ms: 12,
  channel_id: 7,
  channel_name: 'openai-main',
  model: 'gpt-x',
  is_stream: true,
  status_code: 500,
  size: 2048,
}

const listResponse = {
  items: [listEntry],
  total: 1,
  page: 0,
  page_size: 20,
}

const detailResponse = {
  request_id: 'req-1',
  created_at: 1730000000000,
  duration_ms: 12,
  channel_id: 7,
  channel_name: 'openai-main',
  model: 'gpt-x',
  is_stream: true,
  request_path: '/v1/chat/completions',
  request: {
    method: 'POST',
    url: 'https://upstream.test/v1/chat',
    headers: {
      Authorization: ['<redacted>'],
      'Content-Type': ['application/json'],
    },
    body: 'ping',
  },
  response: {
    status_code: 500,
    headers: { 'Content-Type': ['application/json'] },
    body: 'pong',
  },
}

type ApiReply = { data: { success: boolean; data: unknown } }

function mockListAndDetail(list: ApiReply['data']['data']) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (String(url).startsWith('/api/relay_dump/')) {
      if (String(url).includes('req-1')) {
        return { data: { success: true, data: detailResponse } }
      }
      return { data: { success: true, data: list } }
    }
    return { data: { success: true, data: null } }
  })
}

function Fixture() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <RelayDumpSection defaultValues={defaults} />
      </SettingsPageProvider>
    </>
  )
}

async function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Fixture />
    </QueryClientProvider>
  )
  return screen.findByRole('group', { name: 'Capture settings' })
}

beforeEach(() => {
  mockListAndDetail({ items: [], total: 0, page: 0, page_size: 20 })
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
  vi.spyOn(api, 'delete').mockResolvedValue({
    data: { success: true, data: { deleted: 1 } },
  })
})

test('shows the capture form and an empty capture list when nothing is stored', async () => {
  await renderSection()

  expect(
    within(screen.getByRole('group', { name: 'Capture settings' })).getByRole(
      'switch',
      { name: 'Enable relay dump' }
    )
  ).toBeChecked()
  expect(
    screen.getByRole('group', { name: 'Captured exchanges' })
  ).toBeVisible()
  expect(await screen.findByText('No captures yet')).toBeVisible()
  expect(
    within(screen.getByRole('group', { name: 'Captured exchanges' })).getByRole(
      'button',
      { name: 'Clear all' }
    )
  ).toBeVisible()
})

test('lists captures and opens the detail dialog with redacted headers and bodies', async () => {
  const user = userEvent.setup()
  mockListAndDetail(listResponse)
  await renderSection()

  const viewer = screen.getByRole('group', { name: 'Captured exchanges' })
  expect(await within(viewer).findByText('gpt-x')).toBeVisible()
  expect(within(viewer).getByText('openai-main')).toBeVisible()

  await user.click(within(viewer).getByRole('button', { name: 'View' }))

  const dialog = await screen.findByRole('dialog', { name: 'Capture detail' })
  expect(await within(dialog).findByText('<redacted>')).toBeVisible()
  expect(within(dialog).getAllByText('ping').length).toBeGreaterThan(0)
  expect(within(dialog).getAllByText('pong').length).toBeGreaterThan(0)
})

test('deletes one capture after confirmation', async () => {
  const user = userEvent.setup()
  mockListAndDetail(listResponse)
  await renderSection()

  const viewer = screen.getByRole('group', { name: 'Captured exchanges' })
  await user.click(
    await within(viewer).findByRole('button', { name: 'Delete capture' })
  )

  expect(screen.getByText('Delete this capture?')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  await waitFor(() => {
    expect(api.delete).toHaveBeenCalledWith(`/api/relay_dump/${listEntry.id}`)
  })
  expect(api.delete).toHaveBeenCalledTimes(1)
})

test('clears all captures after confirmation', async () => {
  const user = userEvent.setup()
  await renderSection()

  const viewer = screen.getByRole('group', { name: 'Captured exchanges' })
  await user.click(await within(viewer).findByRole('button', { name: 'Clear all' }))

  expect(screen.getByText('Clear all captures?')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  await waitFor(() => {
    expect(api.delete).toHaveBeenCalledWith('/api/relay_dump/')
  })
  expect(api.delete).toHaveBeenCalledTimes(1)
})

test('saves changed capture settings and JSON-encodes the redaction list', async () => {
  const user = userEvent.setup()
  await renderSection()

  const capture = screen.getByRole('group', { name: 'Capture settings' })
  await user.click(
    within(capture).getByRole('switch', { name: 'Enable relay dump' })
  )
  const redactField = within(capture).getByRole('textbox', {
    name: 'Additional redacted headers',
  })
  await user.clear(redactField)
  await user.type(redactField, 'X-Internal-Secret')

  await user.click(
    screen.getByRole('button', { name: 'Save relay dump settings' })
  )

  await waitFor(() => {
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'relay_dump_setting.enabled',
      value: false,
    })
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'relay_dump_setting.redact_list',
      value: '["X-Internal-Secret"]',
    })
  })
  expect(api.put).toHaveBeenCalledTimes(2)
})

test('does not save when nothing changed', async () => {
  const user = userEvent.setup()
  await renderSection()

  await user.click(
    screen.getByRole('button', { name: 'Save relay dump settings' })
  )

  await waitFor(() => {
    expect(api.put).not.toHaveBeenCalled()
  })
})
