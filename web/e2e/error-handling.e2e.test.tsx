import { render, screen } from '@testing-library/react'
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
import { AxiosError, type AxiosAdapter } from 'axios'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClientErrorBoundary } from '@/apps/client/layout/client-error-boundary'
import { api } from '@/shared/lib/http-client'
import { createAppQueryClient } from '@/shared/lib/query-client'

const originalAdapter = api.defaults.adapter

function axiosError(status: number, message: string): AxiosError {
  const config = { headers: {} } as never
  return new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
    data: { success: false, message },
    status,
    statusText: message,
    headers: {},
    config,
  })
}

function statusAdapter(status: number, message: string): AxiosAdapter {
  return async (config) => {
    throw new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
      data: { success: false, message },
      status,
      statusText: message,
      headers: {},
      config,
    })
  }
}

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Phase 4.1 - 402 Payment Required
// ---------------------------------------------------------------------------

describe('phase 4 - 402 Payment Required', () => {
  it('is surfaced as a normal failure (toast) and never forces a redirect', async () => {
    api.defaults.adapter = statusAdapter(402, 'Insufficient quota')
    const error = vi.spyOn(toast, 'error')
    const onInternalServerError = vi.fn()
    const queryClient = createAppQueryClient(onInternalServerError)

    await expect(
      queryClient.fetchQuery({
        queryKey: ['phase4-payment-required'],
        queryFn: () => api.get('/api/user/self'),
      })
    ).rejects.toBeInstanceOf(AxiosError)

    expect(error).toHaveBeenCalled()
    // A payment failure is not an internal server error nor an auth failure.
    expect(onInternalServerError).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Phase 4.2 - 500 Internal Server Error
// ---------------------------------------------------------------------------

describe('phase 4 - 500 Internal Server Error', () => {
  it('routes to the error page while still showing a toast', async () => {
    const error = vi.spyOn(toast, 'error')
    const onInternalServerError = vi.fn()
    const queryClient = createAppQueryClient(onInternalServerError)

    await expect(
      queryClient.fetchQuery({
        queryKey: ['phase4-internal-error'],
        queryFn: () => Promise.reject(axiosError(500, 'Internal error')),
      })
    ).rejects.toBeInstanceOf(AxiosError)

    expect(error).toHaveBeenCalled()
    expect(onInternalServerError).toHaveBeenCalledTimes(1)
  })

  it('a render crash shows a graceful error state instead of a blank screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function Exploding(): React.ReactNode {
      throw new Error('boom')
    }

    render(
      <ClientErrorBoundary>
        <Exploding />
      </ClientErrorBoundary>
    )

    expect(screen.getByText('Oops! Something went wrong')).toBeVisible()
    expect(screen.getByText('boom')).toBeVisible()
  })
})
