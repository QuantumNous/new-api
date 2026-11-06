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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SignUpForm } from '../../sign-up/components/sign-up-form'
import type { SystemStatus } from '../../types'
import { getRegistrationAvailability } from '../registration'

const status = vi.hoisted(() => ({
  current: null as SystemStatus | null,
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: status.current, loading: false, error: null }),
}))

vi.mock('@/features/auth/hooks/use-auth-redirect', () => ({
  useAuthRedirect: () => ({
    redirectToLogin: vi.fn(),
    handleLoginResult: vi.fn(),
  }),
}))

beforeEach(() => {
  status.current = null
})

const customProvider = {
  id: 1,
  name: 'Example',
  slug: 'example',
  icon: '',
  client_id: 'client-id',
  authorization_endpoint: 'https://example.com/oauth/authorize',
  scopes: 'profile',
}

describe('registration availability', () => {
  it('keeps OAuth registration available when local registration is disabled', () => {
    const status: SystemStatus = {
      register_enabled: true,
      local_registration_disabled: true,
      custom_oauth_providers: [customProvider],
    }

    expect(getRegistrationAvailability(status)).toEqual({
      local: false,
      oauth: true,
    })
  })

  it('keeps local registration available when no OAuth provider is enabled', () => {
    const status: SystemStatus = {
      register_enabled: true,
      local_registration_disabled: false,
    }

    expect(getRegistrationAvailability(status)).toEqual({
      local: true,
      oauth: false,
    })
  })

  it('requires global registration for both local and OAuth sign-up', () => {
    const status: SystemStatus = {
      register_enabled: false,
      local_registration_disabled: false,
      custom_oauth_providers: [customProvider],
    }

    expect(getRegistrationAvailability(status)).toEqual({
      local: false,
      oauth: false,
    })
  })

  it('honors an explicit OAuth registration disable', () => {
    const status: SystemStatus = {
      register_enabled: true,
      local_registration_disabled: true,
      oauth_register_enabled: false,
      custom_oauth_providers: [customProvider],
    }

    expect(getRegistrationAvailability(status)).toEqual({
      local: false,
      oauth: false,
    })
  })

  it('renders only the OAuth path when local registration is disabled', () => {
    status.current = {
      register_enabled: true,
      local_registration_disabled: true,
      custom_oauth_providers: [customProvider],
    }

    render(<SignUpForm />)

    expect(screen.queryByPlaceholderText('Enter your username')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Continue with Example' })
    ).toBeInTheDocument()
    expect(screen.queryByText('Or continue with')).toBeNull()
  })
})
