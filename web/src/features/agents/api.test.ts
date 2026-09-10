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
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { describe, expect, test } from 'vitest'

import { api } from '@/lib/api'

import {
  exportAgentCodes,
  getAdminAgentOrders,
  getAgentAccessOverview,
  getAgentCodes,
  getAgentCustomerLogs,
  getAgentCustomers,
  getAgentOrders,
  redeemTypedCode,
} from './api'
import type {
  AgentCodeParams,
  AgentCustomerLogParams,
  AgentCustomerParams,
  AgentOrderParams,
} from './types'

const emptyPage = {
  success: true,
  message: '',
  data: { page: 1, page_size: 10, total: 0, items: [] },
}

function response(
  config: InternalAxiosRequestConfig,
  data: unknown,
  contentType = 'application/json',
  extraHeaders: Record<string, string | undefined> = {}
): AxiosResponse {
  return {
    config,
    data,
    headers: {
      'content-type': contentType,
      ...Object.fromEntries(
        Object.entries(extraHeaders).filter(([, value]) => value !== undefined)
      ),
    },
    status: 200,
    statusText: 'OK',
  }
}

describe('agent API request isolation', () => {
  test('whitelists self-service order, code, and export filters', async () => {
    const originalAdapter = api.defaults.adapter
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (config) => {
      requests.push(config)
      if (config.url?.endsWith('/export')) {
        return response(config, new Blob(['code\n']), 'text/csv; charset=utf-8')
      }
      return response(config, emptyPage)
    }
    api.defaults.adapter = adapter

    try {
      const orderParams = {
        p: 2,
        plan_id: 7,
        agent_user_id: 999,
        unexpected: 'drop-me',
      } as AgentOrderParams & { unexpected: string }
      const codeParams = {
        page_size: 25,
        order_id: 8,
        agent_user_id: 999,
        unexpected: 'drop-me',
      } as AgentCodeParams & { unexpected: string }

      await getAgentOrders(orderParams)
      await getAgentCodes(codeParams)
      await exportAgentCodes(codeParams)

      expect(requests.length).toBe(3)
      for (const request of requests) {
        const params = request.params as Record<string, unknown>
        expect(Object.hasOwn(params, 'agent_user_id')).toBe(false)
        expect(Object.hasOwn(params, 'unexpected')).toBe(false)
      }
      expect((requests[0].params as Record<string, unknown>).plan_id).toBe(7)
      expect((requests[1].params as Record<string, unknown>).order_id).toBe(8)
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('whitelists customer and customer-log filters', async () => {
    const originalAdapter = api.defaults.adapter
    const requests: InternalAxiosRequestConfig[] = []
    api.defaults.adapter = async (config) => {
      requests.push(config)
      return response(config, emptyPage)
    }

    try {
      const customerParams = {
        keyword: 'alice',
        sort_by: 'remaining_quota',
        sort_order: 'asc',
        agent_user_id: 999,
        unexpected: 'drop-me',
      } as AgentCustomerParams & {
        agent_user_id: number
        unexpected: string
      }
      const logParams = {
        username: 'alice',
        model_name: 'gpt-5',
        type: 2,
        agent_user_id: 999,
        unexpected: 'drop-me',
      } as AgentCustomerLogParams & {
        agent_user_id: number
        unexpected: string
      }

      await getAgentCustomers(customerParams)
      await getAgentCustomerLogs(logParams)

      expect(requests.length).toBe(2)
      for (const request of requests) {
        const params = request.params as Record<string, unknown>
        expect(Object.hasOwn(params, 'agent_user_id')).toBe(false)
        expect(Object.hasOwn(params, 'unexpected')).toBe(false)
      }
      expect((requests[0].params as Record<string, unknown>).sort_by).toBe(
        'remaining_quota'
      )
      expect((requests[1].params as Record<string, unknown>).model_name).toBe(
        'gpt-5'
      )
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('preserves the admin agent filter', async () => {
    const originalAdapter = api.defaults.adapter
    let captured: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config) => {
      captured = config
      return response(config, emptyPage)
    }

    try {
      await getAdminAgentOrders({ agent_user_id: 42 })
      expect(captured).toBeTruthy()
      if (!captured) {
        throw new Error('expected captured request')
      }
      expect((captured.params as Record<string, unknown>).agent_user_id).toBe(
        42
      )
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('isolates the access probe from ordinary duplicate GET requests', async () => {
    const originalAdapter = api.defaults.adapter
    let captured: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config) => {
      captured = config
      return response(config, {
        success: false,
        message: 'agent account not found',
      })
    }

    try {
      const result = await getAgentAccessOverview()
      expect(result.success).toBe(false)
      expect(captured?.skipBusinessError).toBe(true)
      expect(captured?.skipErrorHandler).toBe(true)
      expect(captured?.disableDuplicate).toBe(true)
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('lets wallet redemption own business and transport error feedback', async () => {
    const originalAdapter = api.defaults.adapter
    let captured: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config) => {
      captured = config
      return response(config, {
        success: true,
        message: '',
        data: { type: 'quota', quota: 0 },
      })
    }

    try {
      const result = await redeemTypedCode({ key: 'quota-code' })
      expect(result.success).toBe(true)
      expect(captured?.skipBusinessError).toBe(true)
      expect(captured?.skipErrorHandler).toBe(true)
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  test('uses a safe server export filename and rejects path traversal', async () => {
    const originalAdapter = api.defaults.adapter
    const contentDispositions = [
      "attachment; filename*=UTF-8''agent-codes-%E4%B8%AD%E6%96%87.csv",
      'attachment; filename="agent-codes-july.csv"',
      'attachment; filename="../private.csv"',
      'attachment; filename="agent-codes\u0007.csv"',
    ]
    api.defaults.adapter = async (config) =>
      response(config, new Blob(['code\n']), 'text/csv; charset=utf-8', {
        'content-disposition': contentDispositions.shift(),
      })

    try {
      const safe = await exportAgentCodes()
      expect(safe.filename).toBe('agent-codes-中文.csv')
      const basic = await exportAgentCodes()
      expect(basic.filename).toBe('agent-codes-july.csv')
      const rejected = await exportAgentCodes()
      expect(rejected.filename).toBe('agent-codes.csv')
      const controlCharacter = await exportAgentCodes()
      expect(controlCharacter.filename).toBe('agent-codes.csv')
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })
})
