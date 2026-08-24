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
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { PlaygroundRecordPayload } from './types'

const get = mock(async (_path: string) => ({ data: { success: true } }))
const post = mock(async (_path: string, _body?: unknown) => ({
  data: { success: true },
}))
const getStatus = mock(async () => ({ success: true, data: {} }))
const getNotice = mock(async () => ({ success: true, data: '' }))
const getCommonHeaders = mock(() => ({}))
const getSelf = mock(async () => ({ success: true, data: {} }))
const getUserModels = mock(async () => ({ success: true, data: [] }))
const getUserGroups = mock(async () => ({ success: true, data: {} }))
const get2FAStatus = mock(async () => ({ success: true, data: {} }))
const setup2FA = mock(async () => ({ success: true, data: {} }))
const enable2FA = mock(async () => ({ success: true, data: {} }))
const disable2FA = mock(async () => ({ success: true, data: {} }))
const regenerate2FABackupCodes = mock(async () => ({
  success: true,
  data: {},
}))

mock.module('@/lib/api', () => ({
  api: { get, post },
  getStatus,
  getNotice,
  getCommonHeaders,
  getSelf,
  getUserModels,
  getUserGroups,
  get2FAStatus,
  setup2FA,
  enable2FA,
  disable2FA,
  regenerate2FABackupCodes,
}))

const {
  clearCurrentPlaygroundRecord,
  getCurrentPlaygroundRecord,
  savePlaygroundRecord,
} = await import('./api')

const payload = {
  record_id: '550e8400-e29b-41d4-a716-446655440000',
  conversation_id: '550e8400-e29b-41d4-a716-446655440001',
} as PlaygroundRecordPayload

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
