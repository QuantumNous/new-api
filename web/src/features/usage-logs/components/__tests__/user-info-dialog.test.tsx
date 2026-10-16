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
import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { UserInfoDialog } from '../dialogs/user-info-dialog'

afterEach(() => vi.restoreAllMocks())

test.each([
  'user@example.com',
  'a.very.long.email.address.for.testing.wrapping@a-long-example-domain.example.com',
  '',
  undefined,
])('user details display email with an empty fallback (%s)', async (email) => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        id: 1,
        username: 'demo',
        email,
        quota: 0,
        used_quota: 0,
        request_count: 0,
      },
    },
  })
  render(<UserInfoDialog open userId={1} onOpenChange={vi.fn()} />)
  expect(await screen.findByText('Email')).toBeVisible()
  const value = screen.getByText(email || '-')
  expect(value).toBeVisible()
  expect(value).toHaveClass('break-all')
})
