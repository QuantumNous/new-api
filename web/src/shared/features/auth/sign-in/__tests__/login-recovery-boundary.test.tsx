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
import { Component, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LoginRecoveryBoundary } from '../login-recovery-boundary'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

let mountAttempts = 0

/**
 * Throwing during render lets React 19 recover by re-rendering the root
 * synchronously, which bypasses the boundary in tests. A committed lifecycle
 * throw is handled by the same boundary path without that retry.
 */
class FlakyLogin extends Component {
  componentDidMount(): void {
    mountAttempts += 1
    if (mountAttempts === 1) {
      throw new Error('corrupt local auth state')
    }
  }

  render(): ReactNode {
    return <div>login form</div>
  }
}

class BrokenLogin extends Component {
  componentDidMount(): void {
    throw new Error('always broken')
  }

  render(): ReactNode {
    return <div>broken form</div>
  }
}

afterEach(() => {
  mountAttempts = 0
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('LoginRecoveryBoundary', () => {
  it('clears stale auth storage and remounts the form after one crash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    localStorage.setItem('user', '{"id":7}')

    render(
      <LoginRecoveryBoundary>
        <FlakyLogin />
      </LoginRecoveryBoundary>,
      { onCaughtError: () => undefined }
    )

    expect(await screen.findByText('login form')).toBeTruthy()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('shows the login error screen when the retry also crashes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <LoginRecoveryBoundary>
        <BrokenLogin />
      </LoginRecoveryBoundary>,
      { onCaughtError: () => undefined }
    )

    expect(await screen.findByRole('button')).toBeTruthy()
    expect(
      screen.getByText('Something went wrong, please refresh')
    ).toBeTruthy()
  })
})
