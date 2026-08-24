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
import { afterAll, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { api } from '@/lib/api'
import type { PlaygroundRecordPayload } from './types'

const get = spyOn(api, 'get').mockResolvedValue({
  data: { success: true },
} as never)
const post = spyOn(api, 'post').mockResolvedValue({
  data: { success: true },
} as never)

const {
  clearCurrentPlaygroundRecord,
  getCurrentPlaygroundRecord,
  getUserModels: fetchUserModels,
  savePlaygroundRecord,
} = await import('./api')

const payload = {
  record_id: '550e8400-e29b-41d4-a716-446655440000',
  conversation_id: '550e8400-e29b-41d4-a716-446655440001',
} as PlaygroundRecordPayload

afterAll(() => {
  get.mockRestore()
  post.mockRestore()
})

describe('Playground persistence API', () => {
  beforeEach(() => {
    get.mockClear()
    post.mockClear()
  })

  test('saves a terminal record through the authenticated endpoint', async () => {
    post.mockResolvedValueOnce({ data: { success: true } })

    await savePlaygroundRecord(payload)

    expect(post).toHaveBeenCalledWith('/api/playground/records', payload)
  })

  test('returns the current conversation snapshot', async () => {
    const current = {
      conversation_id: payload.conversation_id,
      messages: [],
    }
    get.mockResolvedValueOnce({ data: { success: true, data: current } })

    await expect(getCurrentPlaygroundRecord()).resolves.toEqual(current)
    expect(get).toHaveBeenCalledWith('/api/playground/records/current')
  })

  test('preserves an explicit null current conversation', async () => {
    get.mockResolvedValueOnce({ data: { success: true, data: null } })

    await expect(getCurrentPlaygroundRecord()).resolves.toBeNull()
  })

  test('surfaces an API failure message', async () => {
    post.mockResolvedValueOnce({
      data: { success: false, message: 'save failed' },
    })

    await expect(savePlaygroundRecord(payload)).rejects.toThrow('save failed')
  })

  test('clears only after the authenticated API accepts the marker', async () => {
    post.mockResolvedValueOnce({ data: { success: true } })

    await clearCurrentPlaygroundRecord(
      payload.record_id,
      payload.conversation_id,
      2500
    )

    expect(post).toHaveBeenCalledWith('/api/playground/records/clear', {
      record_id: payload.record_id,
      conversation_id: payload.conversation_id,
      client_completed_at: 2500,
    })
  })
})

describe('Playground model API', () => {
  beforeEach(() => {
    get.mockClear()
  })

  test('asks the backend to exclude administratively hidden models', async () => {
    get.mockResolvedValueOnce({
      data: {
        success: true,
        data: ['gpt-4o', ' seedance-2.5 ', null],
      },
    })

    await expect(fetchUserModels('plg')).resolves.toEqual([
      'gpt-4o',
      'seedance-2.5',
    ])
    expect(get).toHaveBeenCalledWith('/api/user/models', {
      params: { group: 'plg', exclude_hidden: true },
    })
  })
})
