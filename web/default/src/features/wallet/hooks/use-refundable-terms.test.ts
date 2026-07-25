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
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as refundableTermsHook from './use-refundable-terms'

type RefundableTermsQueryKeys = {
  all: readonly string[]
  detail: (userId?: number) => readonly unknown[]
}

describe('refundable term query keys', () => {
  test('partitions cached refundable terms by authenticated user', () => {
    const queryKeys = (
      refundableTermsHook as {
        refundableTermsQueryKeys?: RefundableTermsQueryKeys
      }
    ).refundableTermsQueryKeys

    expect(queryKeys).toBeDefined()
    if (!queryKeys) return

    expect(queryKeys.detail(7)).toEqual([
      'subscription',
      'self',
      'refundable-terms',
      7,
    ])
    expect(queryKeys.detail(8)).not.toEqual(queryKeys.detail(7))
    expect(queryKeys.detail()).toEqual([
      'subscription',
      'self',
      'refundable-terms',
      null,
    ])
  })

  test('rejects a failed refundable-terms response instead of treating it as empty data', async () => {
    const loadRefundableTerms = (
      refundableTermsHook as {
        loadRefundableTerms?: (
          request?: () => Promise<{
            success?: boolean
            message?: string
          }>
        ) => Promise<unknown>
      }
    ).loadRefundableTerms

    expect(loadRefundableTerms).toBeDefined()
    if (!loadRefundableTerms) return

    await expect(
      loadRefundableTerms(async () => ({
        success: false,
        message: 'refund terms unavailable',
      }))
    ).rejects.toThrow('refund terms unavailable')
  })

  test('exposes query error and retry state after refundable terms fail to load', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnMount: false },
      },
    })

    try {
      await queryClient.prefetchQuery({
        queryKey: refundableTermsHook.refundableTermsQueryKeys.detail(),
        queryFn: async () => {
          throw new Error('refund terms unavailable')
        },
      })

      function HookStateProbe() {
        const state = refundableTermsHook.useRefundableTerms() as ReturnType<
          typeof refundableTermsHook.useRefundableTerms
        > & {
          error?: boolean
          retry?: () => Promise<void>
          retrying?: boolean
        }

        return createElement(
          'span',
          null,
          `${String(state.error)}|${typeof state.retry}|${String(state.retrying)}`
        )
      }

      const html = renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(HookStateProbe)
        )
      )

      expect(html).toContain('true|function|false')
    } finally {
      queryClient.clear()
    }
  })
})
