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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { SignUpForm } from '@/features/auth/sign-up/components/sign-up-form'

const testState = vi.hoisted(() => ({
  status: {
    turnstile_check: true,
    turnstile_site_key: 'test-site-key',
    email_verification: false,
    oauth_register_enabled: false,
  },
  register: vi.fn(),
  redirectToLogin: vi.fn(),
}))

vi.mock('@/features/auth/api', () => ({
  register: testState.register,
  wechatLoginByCode: vi.fn(),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: testState.status }),
}))

vi.mock('@/features/auth/hooks/use-auth-redirect', () => ({
  useAuthRedirect: () => ({
    redirectToLogin: testState.redirectToLogin,
    handleLoginSuccess: vi.fn(),
  }),
}))

type TurnstileOptions = Record<string, unknown>

describe('SignUpForm Turnstile flow', () => {
  beforeEach(() => {
    testState.register.mockReset()
    testState.redirectToLogin.mockReset()
    testState.register.mockResolvedValue({
      success: false,
      message: 'Registration failed for test',
    })
    delete window.turnstile
    document.head.innerHTML = ''
  })

  test('uses the submitted token once and mounts a fresh widget before a retryable response', async () => {
    const user = userEvent.setup()
    const renderOptions: TurnstileOptions[] = []
    window.turnstile = {
      render: vi.fn((_element: HTMLElement, options: TurnstileOptions) => {
        renderOptions.push(options)
        return renderOptions.length
      }),
      remove: vi.fn(),
    }

    render(<SignUpForm />)
    await waitFor(() => expect(renderOptions).toHaveLength(1))

    const verify = renderOptions[0].callback as (token: string) => void
    verify('token-used-once')

    await user.type(screen.getByLabelText('Username'), 'new-user')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(testState.register).toHaveBeenCalledTimes(1))
    expect(testState.register.mock.calls[0][0]).toMatchObject({
      turnstile: 'token-used-once',
    })
    await waitFor(() => expect(renderOptions).toHaveLength(2))
  })

  test('exposes an accessible error and retry action when Turnstile rendering fails', async () => {
    const user = userEvent.setup()
    let renderCount = 0
    window.turnstile = {
      render: vi.fn(() => {
        renderCount += 1
        if (renderCount === 1) {
          throw new Error('render failure')
        }
        return renderCount
      }),
      remove: vi.fn(),
    }

    render(<SignUpForm />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Human verification failed. Please retry.')
    const retryButton = screen.getByRole('button', {
      name: 'Retry human verification',
    })
    expect(retryButton).toBeEnabled()

    await user.click(retryButton)

    await waitFor(() => expect(renderCount).toBe(2))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Human verification is loading...'
    )
  })
})
