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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import type { UserProfile } from '../../types'
import { ProfileHeader } from '../profile-header'

const profile = {
  id: 1,
  username: 'admin',
  display_name: 'Admin',
  role: 1,
  group: 'default',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  status: 1,
} as UserProfile

afterEach(() => {
  cleanup()
})

it('isolates the @username handle so the @ stays in front of a Latin username on a right-to-left page', () => {
  render(
    <div dir='rtl'>
      <ProfileHeader profile={profile} loading={false} />
    </div>
  )

  expect(screen.getByText('@admin')).toHaveAttribute('dir', 'auto')
})
