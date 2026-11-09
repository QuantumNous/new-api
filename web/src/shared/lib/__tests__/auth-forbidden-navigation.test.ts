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
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '../http-client'

const originalLocation = window.location
const originalAdapter = api.defaults.adapter

function stubLocation(pathname: string): ReturnType<typeof vi.fn> {
  const replace = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { pathname, replace, href: '', origin: 'http://localhost' },
  })
  return replace
}

function forbiddenAdapter(): AxiosAdapter {
  return async (config) => {
    throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, {
      data: { success: false, message: 'forbidden' },
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config,
    })
  }
}

afterEach(() => {
  api.defaults.adapter = originalAdapter
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  })
})

it('a 403 authorization denial sends the user to the forbidden page', async () => {
  const replace = stubLocation('/admin/overview')
  api.defaults.adapter = forbiddenAdapter()

  await expect(api.get('/api/admin/thing')).rejects.toBeInstanceOf(AxiosError)

  expect(replace).toHaveBeenCalledWith('/403')
})

it('a 403 from a caller that opted out of the error handler keeps the current page', async () => {
  const replace = stubLocation('/admin/overview')
  api.defaults.adapter = forbiddenAdapter()

  await expect(
    api.post('/api/user/auth/logout', undefined, {
      skipAuthRefresh: true,
      skipErrorHandler: true,
    })
  ).rejects.toBeInstanceOf(AxiosError)

  expect(replace).not.toHaveBeenCalled()
})
