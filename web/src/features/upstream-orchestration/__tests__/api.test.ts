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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  createPairingCode,
  getUpstreamMetrics,
  getUpstreamOverview,
  getUpstreamPrices,
  reconcileUpstreams,
  requestUpstreamSync,
  updateUpstreamSettings,
  updateUpstreamRoute,
} from '../api'

const { get, post, put } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get,
    post,
    put,
  },
}))

describe('upstream orchestration API envelopes', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
  })

  for (const testCase of [
    { name: 'overview query', invoke: () => getUpstreamOverview() },
    { name: 'metrics query', invoke: () => getUpstreamMetrics() },
    { name: 'prices query', invoke: () => getUpstreamPrices() },
    { name: 'sync mutation', invoke: () => requestUpstreamSync() },
    { name: 'reconcile mutation', invoke: () => reconcileUpstreams() },
    { name: 'pairing mutation', invoke: () => createPairingCode() },
    {
      name: 'route mutation',
      invoke: () => updateUpstreamRoute(41, 'detach'),
    },
    {
      name: 'settings mutation',
      invoke: () =>
        updateUpstreamSettings({
          target_groups: ['default'],
          model_aliases: {},
          model_exclusions: {},
          protocol_model_exclusions: {},
        }),
    },
  ]) {
    test(`${testCase.name} rejects an HTTP 200 business failure`, async () => {
      const response = {
        data: {
          success: false,
          message: 'Backend rejected the upstream operation',
        },
      }
      get.mockResolvedValue(response)
      post.mockResolvedValue(response)
      put.mockResolvedValue(response)

      await expect(testCase.invoke()).rejects.toThrow(
        'Backend rejected the upstream operation'
      )
    })
  }

  test('successful pairing returns the code payload', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: '',
        data: {
          device_id: 'device-1',
          pairing_code: 'ABC123',
          expires_at: 1_800_000_000,
        },
      },
    })

    await expect(createPairingCode()).resolves.toEqual({
      device_id: 'device-1',
      pairing_code: 'ABC123',
      expires_at: 1_800_000_000,
    })
  })

  test('settings update sends the complete policy snapshot', async () => {
    const settings = {
      target_groups: ['default', 'vip'],
      model_aliases: { public: 'upstream' },
      model_exclusions: { 'leyi:paid': ['blocked'] },
      protocol_model_exclusions: { openai: ['unsupported'] },
    }
    put.mockResolvedValue({
      data: {
        success: true,
        message: '',
        data: settings,
      },
    })

    await expect(updateUpstreamSettings(settings)).resolves.toEqual(settings)
    expect(put).toHaveBeenCalledWith(
      '/api/upstream-orchestration/settings',
      settings
    )
  })
})
