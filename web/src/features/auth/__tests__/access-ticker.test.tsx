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
import { QueryClient } from '@tanstack/react-query'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { renderApp } from '@/test-utils/render-app'

import { AccessAuthLayout } from '../access-auth-layout'

let client: QueryClient
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(['status'], {}, { updatedAt: Date.now() + 60000 })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
})

describe('auth welcome layout', () => {
  it('keeps the login form available without querying the model catalog', async () => {
    const requests = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: [] } })
    await renderApp(
      <AccessAuthLayout title='Welcome back'>
        <label>
          Username
          <input />
        </label>
        <button type='submit'>Sign in</button>
      </AccessAuthLayout>,
      client
    )

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Username' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible()
    expect(screen.queryByText('Live prices')).toBeNull()
    expect(
      requests.mock.calls.some(([url]) => url.includes('/api/pricing'))
    ).toBe(false)
  })

  it('offers a home link and accessible appearance controls around the form', async () => {
    await renderApp(
      <AccessAuthLayout title='Sign in'>
        <p>Login form</p>
      </AccessAuthLayout>,
      client
    )

    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute(
      'href',
      '/'
    )
    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' })
    ).toBeVisible()
    expect(screen.getByText('Login form')).toBeVisible()
  })
})
