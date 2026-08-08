import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallCampaignSummary } from '../types'

mock.module('@tanstack/react-router', () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} />
  ),
}))

mock.module('@/components/data-table', () => ({
  DataTablePage: (props: {
    table: {
      getRowModel: () => {
        rows: Array<{
          id: string
          getVisibleCells: () => Array<{
            id: string
            column: { columnDef: { cell?: unknown } }
            getContext: () => unknown
          }>
        }>
      }
    }
  }) => (
    <table>
      <tbody>
        {props.table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => {
              const renderer = cell.column.columnDef.cell
              return (
                <td key={cell.id}>
                  {typeof renderer === 'function'
                    ? renderer(cell.getContext())
                    : null}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

mock.module('../api', () => ({
  listRecallCampaigns: mock(() =>
    Promise.resolve({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      },
    })
  ),
  recallCampaignKeys: {
    list: (search: { p: number; ps: number }) => [
      'recall-campaigns',
      'list',
      search,
    ],
  },
}))

const { CampaignTable } = await import('./campaign-table')
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

afterAll(() => {
  mock.restore()
})

function makeContinuousSummary(): RecallCampaignSummary {
  return {
    id: 42,
    campaign_type: 'content_only',
    name: 'Low quota lifecycle',
    status: 'running',
    audience_template: 'first_purchase',
    execution_mode: 'continuous',
    lifecycle_trigger: 'quota_low',
    delivery_policy: 'service',
    processing_start_at: 1_900_000_000,
    scheduled_at: 0,
    next_run_at: 0,
    coupon_source: 'automatic',
    stripe_coupon_id: '',
    promotion_expiry_mode: 'relative',
    promotion_expires_at: 0,
    promotion_valid_seconds: 0,
    enrollment_limit: 100,
    worker_concurrency: 2,
    config_revision: 1,
    created_by: 1,
    created_at: 0,
    updated_at: 0,
    activated_at: 0,
    completed_at: 0,
    recipient_total: 0,
  } as RecallCampaignSummary
}

describe('CampaignTable lifecycle columns', () => {
  test('shows continuous execution mode and lifecycle trigger in the list', () => {
    const search = { p: 1, ps: 20 }
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          enabled: false,
          retry: false,
        },
      },
    })
    queryClient.setQueryData(['recall-campaigns', 'list', search], {
      success: true,
      data: {
        items: [makeContinuousSummary()],
        total: 1,
        page: 1,
        page_size: 20,
      },
    })

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <CampaignTable />
        </I18nextProvider>
      </QueryClientProvider>
    )

    expect(html).toContain('Low quota lifecycle')
    expect(html).toContain('continuous')
    expect(html).toContain('quota_low')
  })
})
