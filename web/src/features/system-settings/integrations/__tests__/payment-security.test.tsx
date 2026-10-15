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
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { test, expect, vi } from 'vitest'

import { api } from '@/lib/api'

import { PaymentSecurityStatus } from '../payment-security-status'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

function renderStatus() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PaymentSecurityStatus />
    </QueryClientProvider>
  )
}

test('shows verified credentials, an empty provider and the non-secret key ID', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        key_file_status: 'ready',
        active_key_id: 'key-id',
        alipay: 'verified',
        wechatpay: 'empty',
        migration_enabled: false,
      },
    },
  })
  renderStatus()
  expect(await screen.findByText('Encrypted and verified')).toBeInTheDocument()
  expect(screen.getByText('No stored credentials')).toBeInTheDocument()
  expect(screen.getByText('key-id')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a failed refresh removes the previous healthy result and allows retry', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          key_file_status: 'ready',
          alipay: 'verified',
          wechatpay: 'empty',
          migration_enabled: false,
        },
      },
    })
    .mockRejectedValue(new Error('network'))
  renderStatus()
  await screen.findByText('Encrypted and verified')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await screen.findByText('Unable to check payment security')
  expect(screen.queryByText('Encrypted and verified')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})

test('shows migration and verification warnings without a healthy label', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        key_file_status: 'error',
        alipay: 'unknown',
        wechatpay: 'unknown',
        migration_enabled: true,
      },
    },
  })
  renderStatus()
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
  expect(screen.queryByText('Encrypted and verified')).not.toBeInTheDocument()
})

test('shows WebMoney and Antom checks and warns about corrupted checkout links', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        key_file_status: 'ready',
        alipay: 'empty',
        wechatpay: 'empty',
        webmoney: 'verified',
        antom: 'verified',
        antom_sessions: 'error',
        migration_enabled: false,
      },
    },
  })
  renderStatus()
  expect(await screen.findByText('WebMoney')).toBeVisible()
  expect(screen.getByText('Antom')).toBeVisible()
  expect(screen.getByText('Antom checkout links')).toBeVisible()
  expect(screen.getAllByText('Encrypted and verified')).toHaveLength(2)
  expect(screen.getByText('Verification failed')).toBeVisible()
  expect(screen.getByRole('alert')).toBeVisible()
})
