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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { saveAccountBalanceConfig } from '../../../api'
import { AccountBalanceForm } from '../account-balance-settings'

vi.mock('../../../api', () => ({
  saveAccountBalanceConfig: vi.fn(),
  getAccountBalanceConfig: vi.fn(),
}))

function mount(hasToken = false) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const onSaved = vi.fn()
  const onBusyChange = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <AccountBalanceForm
        channelId={1}
        disabled={false}
        onSaved={onSaved}
        onBusyChange={onBusyChange}
        initial={{
          enabled: true,
          base_url: 'https://goeasyapi.xyz',
          user_id: 42,
          has_access_token: hasToken,
        }}
      />
    </QueryClientProvider>
  )
  return { onSaved, onBusyChange }
}

describe('account balance settings', () => {
  it('rejects a non-HTTPS site before saving credentials', async () => {
    mount(true)
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Upstream account site'))
    await user.type(
      screen.getByLabelText('Upstream account site'),
      'http://wallet.example'
    )
    await user.click(
      screen.getByRole('button', { name: 'Save account balance settings' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter an HTTPS account site URL'
    )
    expect(screen.getByLabelText('Upstream account site')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(saveAccountBalanceConfig).not.toHaveBeenCalled()
  })
  it('saves a separate account token then clears the password input', async () => {
    vi.mocked(saveAccountBalanceConfig).mockResolvedValue()
    const { onSaved } = mount()
    const user = userEvent.setup()
    const input = screen.getByLabelText('Account access token')
    expect(input).toHaveAttribute('type', 'password')
    await user.type(input, 'account-test-token')
    await user.click(
      screen.getByRole('button', { name: 'Save account balance settings' })
    )
    await screen.findByRole('status')
    expect(saveAccountBalanceConfig).toHaveBeenCalledWith(1, {
      enabled: true,
      base_url: 'https://goeasyapi.xyz',
      user_id: 42,
      access_token: 'account-test-token',
    })
    expect(input).toHaveValue('')
    expect(onSaved).toHaveBeenCalledOnce()
  })
  it('preserves a previously saved token by submitting an empty replacement', async () => {
    vi.mocked(saveAccountBalanceConfig).mockResolvedValue()
    mount(true)
    await userEvent.click(
      screen.getByRole('button', { name: 'Save account balance settings' })
    )
    await screen.findByRole('status')
    expect(saveAccountBalanceConfig).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ access_token: '' })
    )
  })
  it('keeps the form and error visible when saving fails', async () => {
    vi.mocked(saveAccountBalanceConfig).mockRejectedValue(
      new Error('Account settings rejected')
    )
    const { onSaved, onBusyChange } = mount(true)
    await userEvent.click(
      screen.getByRole('button', { name: 'Save account balance settings' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account settings rejected'
    )
    expect(onSaved).not.toHaveBeenCalled()
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
    expect(
      screen.getByRole('button', { name: 'Save account balance settings' })
    ).toBeEnabled()
  })
  it('removes account credentials when the wallet lookup is disabled', async () => {
    vi.mocked(saveAccountBalanceConfig).mockResolvedValue()
    mount(true)
    await userEvent.click(
      screen.getByRole('switch', { name: 'Use account wallet balance' })
    )
    expect(
      screen.queryByLabelText('Account access token')
    ).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Save account balance settings' })
    )
    await screen.findByRole('status')
    expect(saveAccountBalanceConfig).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ enabled: false })
    )
  })
})
