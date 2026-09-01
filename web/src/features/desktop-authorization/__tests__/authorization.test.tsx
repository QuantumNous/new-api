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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DesktopAuthorization } from '..'
import { decideDesktopAuthorization } from '../api'

vi.mock('../api', () => ({
  decideDesktopAuthorization: vi.fn(),
}))

const decideMock = vi.mocked(decideDesktopAuthorization)

describe('DesktopAuthorization', () => {
  beforeEach(() => {
    decideMock.mockReset()
  })

  it('approves the exact code shown to the user', async () => {
    decideMock.mockResolvedValue({
      success: true,
      data: { status: 'approved' },
    })
    render(<DesktopAuthorization userCode='abcd-2345' />)

    expect(screen.getByText('ABCD-2345')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect this computer' })
    )

    await waitFor(() =>
      expect(decideMock).toHaveBeenCalledWith('ABCD-2345', 'approve')
    )
    expect(screen.getByText('Connection approved')).toBeInTheDocument()
  })

  it('lets the user decline without granting access', async () => {
    decideMock.mockResolvedValue({
      success: true,
      data: { status: 'denied' },
    })
    render(<DesktopAuthorization userCode='WXYZ-6789' />)

    fireEvent.click(screen.getByRole('button', { name: 'Do not connect' }))

    await waitFor(() =>
      expect(decideMock).toHaveBeenCalledWith('WXYZ-6789', 'deny')
    )
    expect(screen.getByText('Connection declined')).toBeInTheDocument()
  })

  it('does not allow approval without a code', () => {
    render(<DesktopAuthorization />)

    expect(screen.getByText('The connection code is missing')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Connect this computer' })
    ).toBeDisabled()
    expect(decideMock).not.toHaveBeenCalled()
  })

  it('directs the user to restart an expired request', async () => {
    decideMock.mockRejectedValue({
      response: { data: { code: 'expired_token' } },
    })
    render(<DesktopAuthorization userCode='TEST-2345' />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Connect this computer' })
    )

    expect(
      await screen.findByText('This connection request has expired')
    ).toBeVisible()
  })
})
