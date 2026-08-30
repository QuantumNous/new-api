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
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { PluginDetailSheet } from '../components/plugin-detail-sheet'
import type {
  TaskPluginDetail,
  TaskPluginListItem,
  TaskPluginMeta,
} from '../types'

const queryClients: QueryClient[] = []

function makeItem(): TaskPluginListItem {
  return {
    meta: {
      apiVersion: 1,
      key: 'kling',
      name: 'Kling',
      version: '1.2.3',
      author: { name: 'acme' },
      models: ['kling-v1'],
      fetchMode: 'per_task',
    },
    source: 'factory',
    enabled: true,
    active: true,
    source_hash: '',
    remark: '',
    runtime_status: 'registered',
    channel_count: 0,
    in_flight_count: 0,
  }
}

function renderSheet(metaOverrides: Partial<TaskPluginMeta>) {
  const item = makeItem()
  const detail: TaskPluginDetail = {
    meta: { ...item.meta, ...metaOverrides },
    source: '',
    layer: 'factory',
  }
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(['task-plugin', item.meta.key], detail)
  queryClient.setQueryData(['task-plugin-versions', item.meta.key], [])
  queryClients.push(queryClient)
  render(
    <QueryClientProvider client={queryClient}>
      <PluginDetailSheet plugin={item} onOpenChange={() => undefined} />
    </QueryClientProvider>
  )
}

/**
 * The endpoint row that renders `path`, i.e. the list item holding both the
 * method badge and the path. Annotations such as the supported request forms
 * belong to a specific endpoint, so ownership is asserted through this row
 * rather than through document-wide presence.
 */
function endpointRow(path: string): HTMLElement {
  const row = screen.getByText(path).closest('li')
  if (!row) throw new Error(`no endpoint row for ${path}`)
  return row
}

afterEach(() => {
  for (const queryClient of queryClients) queryClient.clear()
  queryClients.length = 0
})

describe('PluginDetailSheet metadata fields', () => {
  test('given a plugin whose manifest cannot declare actions, no actions row is rendered in the metadata card', async () => {
    renderSheet({ protocols: ['openai_video'] })

    // 'Actions' remains a column header in the version-history table, so the
    // removed metadata row is asserted through the metadata card's own list.
    const models = await screen.findByText('Models')
    const metadataList = models.closest('dl')
    expect(metadataList).not.toBeNull()
    expect(metadataList?.textContent).not.toContain('Actions')
  })

  test('given a plugin with several models, the models value renders as one wrapping list', async () => {
    renderSheet({ models: ['kling-v1', 'kling-v1-6', 'kling-v2-master'] })

    expect(
      await screen.findByText('kling-v1, kling-v1-6, kling-v2-master')
    ).toBeInTheDocument()
  })
})

describe('PluginDetailSheet host protocol endpoints', () => {
  test('given an openai_responses claim, both the create and the retrieve endpoint are listed', async () => {
    renderSheet({
      protocols: [{ name: 'openai_responses', supports: ['stream'] }],
    })

    expect(await screen.findByText('/v1/responses')).toBeInTheDocument()
    expect(screen.getByText('/v1/responses/{response_id}')).toBeInTheDocument()
    expect(endpointRow('/v1/responses').textContent).toContain('POST')
    expect(endpointRow('/v1/responses/{response_id}').textContent).toContain(
      'GET'
    )
  })

  test('given an object claim with all supports, the three mode chips sit on the create row', async () => {
    renderSheet({
      protocols: [
        {
          name: 'openai_responses',
          supports: ['stream', 'sync', 'background'],
        },
      ],
    })

    await screen.findByText('/v1/responses')

    const createRow = endpointRow('/v1/responses')
    expect(createRow).toContainElement(screen.getByText('stream'))
    expect(createRow).toContainElement(screen.getByText('sync'))
    expect(createRow).toContainElement(screen.getByText('background'))
  })

  test('given an object claim with all supports, the retrieve row carries no mode chips', async () => {
    renderSheet({
      protocols: [
        {
          name: 'openai_responses',
          supports: ['stream', 'sync', 'background'],
        },
      ],
    })

    await screen.findByText('/v1/responses/{response_id}')

    const retrieveRow = endpointRow('/v1/responses/{response_id}')
    expect(retrieveRow.textContent).not.toContain('stream')
    expect(retrieveRow.textContent).not.toContain('sync')
    expect(retrieveRow.textContent).not.toContain('background')
  })

  test('given an object claim supporting only stream, the other mode chips are absent', async () => {
    renderSheet({
      protocols: [{ name: 'openai_responses', supports: ['stream'] }],
    })

    expect(await screen.findByText('stream')).toBeInTheDocument()
    expect(screen.queryByText('sync')).toBeNull()
    expect(screen.queryByText('background')).toBeNull()
  })

  test('given a string claim, its three endpoints render without any mode chip', async () => {
    renderSheet({ protocols: ['openai_video'] })

    expect(await screen.findByText('/v1/videos')).toBeInTheDocument()
    expect(screen.getByText('/v1/videos/{task_id}')).toBeInTheDocument()
    expect(screen.getByText('/v1/videos/{task_id}/content')).toBeInTheDocument()
    expect(screen.queryByText('stream')).toBeNull()
    expect(screen.queryByText('sync')).toBeNull()
    expect(screen.queryByText('background')).toBeNull()
  })

  test('given a claim narrowing the protocol to a model subset, the subset is marked without printing the model list', async () => {
    renderSheet({
      models: ['kling-v1', 'kling-v2-master'],
      protocols: [{ name: 'openai_video', models: ['kling-v1'] }],
    })

    const hint = await screen.findByText('Model scope')
    expect(hint).toHaveAttribute('title', 'kling-v1')
  })

  test('given a claim binding every model, no model scope marker is rendered', async () => {
    renderSheet({ protocols: ['openai_video'] })

    await screen.findByText('/v1/videos')
    expect(screen.queryByText('Model scope')).toBeNull()
  })
})

describe('PluginDetailSheet native routes', () => {
  test('given declared native routes, each renders its method, path and type', async () => {
    renderSheet({
      routes: [
        {
          method: 'POST',
          path: '/kling/v1/videos/text2video',
          type: 'submit',
        },
        {
          method: 'GET',
          path: '/kling/v1/videos/text2video/:task_id',
          type: 'query',
        },
      ],
    })

    expect(await screen.findByText('Native routes')).toBeInTheDocument()
    const submitRow = endpointRow('/kling/v1/videos/text2video')
    expect(submitRow.textContent).toContain('POST')
    expect(submitRow.textContent).toContain('submit')
    const queryRow = endpointRow('/kling/v1/videos/text2video/:task_id')
    expect(queryRow.textContent).toContain('GET')
    expect(queryRow.textContent).toContain('query')
  })

  test('given no protocols and no routes, the endpoint section falls back to a single placeholder', async () => {
    renderSheet({ protocols: [], routes: [] })

    expect(await screen.findByText('Endpoints')).toBeInTheDocument()
    expect(screen.queryByText('Native routes')).toBeNull()
    const placeholders = screen
      .getAllByText('—')
      .filter((node) => node.tagName === 'P')
    expect(placeholders).toHaveLength(1)
  })
})
