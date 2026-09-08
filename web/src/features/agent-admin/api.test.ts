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
import { describe, test } from 'node:test'

import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import { api } from '@/lib/api'

import { getAgentAdminPlans } from './api'

function response(
  config: InternalAxiosRequestConfig,
  data: unknown
): AxiosResponse {
  return {
    config,
    data,
    headers: { 'content-type': 'application/json' },
    status: 200,
    statusText: 'OK',
  }
}

describe('agent offer plan catalog', () => {
  test('loads every validated subscription plan independently of existing offers', async () => {
    const originalAdapter = api.defaults.adapter
    const adapter: AxiosAdapter = async (config) =>
      response(config, {
        success: true,
        message: '',
        data: [
          {
            plan: {
              id: 5,
              title: 'Pro',
              subtitle: '',
              price_amount: 20,
              currency: 'CNY',
              duration_unit: 'month',
              duration_value: 1,
              custom_seconds: 0,
              enabled: true,
              sort_order: 1,
              allow_balance_pay: true,
              allow_wallet_overflow: true,
              stripe_price_id: '',
              creem_product_id: '',
              waffo_pancake_product_id: '',
              max_purchase_per_user: 0,
              upgrade_group: '',
              downgrade_group: '',
              total_amount: 100,
              quota_reset_period: 'never',
              quota_reset_custom_seconds: 0,
              created_at: 1,
              updated_at: 1,
            },
          },
        ],
      })
    api.defaults.adapter = adapter

    try {
      const result = await getAgentAdminPlans()
      assert.equal(result.success, true)
      if (result.success) assert.equal(result.data[0].title, 'Pro')
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('rejects malformed subscription plan responses before rendering an offer editor', async () => {
    const originalAdapter = api.defaults.adapter
    api.defaults.adapter = async (config) =>
      response(config, {
        success: true,
        message: '',
        data: [{ plan: { id: 5, title: 'Incomplete' } }],
      })

    try {
      await assert.rejects(getAgentAdminPlans())
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })
})
