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
import { act, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeAll, expect, test } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'

const queryClients: QueryClient[] = []
const missingAuditMessage =
  'Audit information was not recorded for this top-up.'
const redemptionAudit = {
  source: 'redemption',
  redemption_id: 42,
  request_ip: '203.0.113.17',
  server_ip: '10.0.0.12',
  node_name: 'redemption-node',
  version: 'v-test',
}

function renderTopupDetails(other: LogOtherData, isAdmin = true): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['status'], {}, { updatedAt: Date.now() + 60_000 })
  queryClients.push(queryClient)
  const log: UsageLog = {
    id: 1,
    user_id: 1,
    created_at: 1,
    type: 1,
    content: 'Topped up with a redemption code',
    username: 'user',
    token_name: '',
    model_name: '',
    quota: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    use_time: 0,
    is_stream: false,
    channel: 0,
    channel_name: '',
    token_id: 0,
    group: '',
    ip: '203.0.113.17',
    other: JSON.stringify(other),
    request_id: '',
    upstream_request_id: '',
  }
  render(
    <QueryClientProvider client={queryClient}>
      <DetailsDialog
        log={log}
        isAdmin={isAdmin}
        isRoot={false}
        open
        onOpenChange={() => undefined}
      />
    </QueryClientProvider>
  )
}

beforeAll(() => {
  i18next.addResourceBundle('en', 'translation', en.translation, true, true)
  i18next.addResourceBundle('zh', 'translation', zh.translation, true, true)
})

afterEach(async () => {
  for (const queryClient of queryClients) queryClient.clear()
  queryClients.length = 0
  await i18next.changeLanguage('en')
})

test('redemption shows its source, code ID and request IP without payment callback fields', () => {
  renderTopupDetails({
    admin_info: {
      ...redemptionAudit,
      payment_method: 'inapplicable-order-method',
      callback_payment_method: 'inapplicable-callback-method',
      caller_ip: '203.0.113.99',
    },
  })

  for (const label of [
    'Top-up Source',
    'Redemption Code',
    'Redemption Code ID',
    'Redemption Request IP',
    'Server IP',
    'Node Name',
    'System Version',
  ]) {
    expect(screen.getByText(label)).toBeVisible()
  }
  for (const value of ['42', '10.0.0.12', 'redemption-node', 'v-test']) {
    expect(screen.getByText(value)).toBeVisible()
  }
  expect(
    screen.getByText('Redemption Request IP').nextElementSibling
  ).toHaveTextContent('203.0.113.17')
  for (const text of [
    'Order Payment Method',
    'Callback Payment Method',
    'Callback Caller IP',
    'inapplicable-order-method',
    'inapplicable-callback-method',
    '203.0.113.99',
  ]) {
    expect(screen.queryByText(text)).not.toBeInTheDocument()
  }
  expect(screen.queryByText(missingAuditMessage)).not.toBeInTheDocument()
  expect(screen.queryByText(/historical record/i)).not.toBeInTheDocument()
})

test('payment top-ups retain the recorded payment and callback details', () => {
  renderTopupDetails({
    admin_info: {
      payment_method: 'card',
      callback_payment_method: 'stripe',
      caller_ip: '203.0.113.18',
      server_ip: '10.0.0.12',
    },
  })

  for (const text of [
    'Order Payment Method',
    'Callback Payment Method',
    'Callback Caller IP',
    'card',
    'stripe',
    '203.0.113.18',
  ]) {
    expect(screen.getByText(text)).toBeVisible()
  }
  expect(screen.queryByText('Redemption Code ID')).not.toBeInTheDocument()
  expect(screen.queryByText(missingAuditMessage)).not.toBeInTheDocument()
})

test.each([{}, { admin_info: {} }])(
  'missing audit information shows a neutral notice without inferring the record version: %j',
  (other) => {
    renderTopupDetails(other)

    expect(screen.getByText(missingAuditMessage)).toBeVisible()
    expect(screen.queryByText(/historical record/i)).not.toBeInTheDocument()
  }
)

test.each([{}, { admin_info: redemptionAudit }])(
  'non-admin viewers see neither administrator audit information nor its warning: %j',
  (other) => {
    renderTopupDetails(other, false)

    for (const text of [
      'Top-up Audit Info',
      'Top-up Source',
      'redemption-node',
      '10.0.0.12',
      '203.0.113.17',
      missingAuditMessage,
    ]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    }
  }
)

test('redemption audit labels follow the selected interface language', async () => {
  renderTopupDetails({ admin_info: redemptionAudit })
  expect(screen.getByText('Redemption Request IP')).toBeVisible()

  await act(async () => {
    await i18next.changeLanguage('zh')
  })

  expect(screen.getByText('兑换请求 IP')).toBeVisible()
  expect(screen.getByText('充值来源')).toBeVisible()
  expect(screen.queryByText('Redemption Request IP')).not.toBeInTheDocument()
})
