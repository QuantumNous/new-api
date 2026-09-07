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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { useInvitationPreview } from '../hooks'
import { AgentInvitations } from '../invitations'

const profile = {
  user_id: 1,
  enabled: true,
  price_cents: 6,
  version: 1,
  updated_at: 1,
}
const existing = {
  token: 'a'.repeat(64),
  price_cents: 6,
  created_at: Math.floor(Date.now() / 1000),
  expires_at: Math.floor(Date.now() / 1000) + 7200,
}
const clients: QueryClient[] = []
function mount(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('generating a 2-cent link preserves the existing 6-cent link and copies the new URL', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [existing] })
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { ...existing, token: 'b'.repeat(64), price_cents: 2 },
  })
  const clipboard = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText: clipboard },
  })
  mount(<AgentInvitations profile={profile} />)
  expect(
    await screen.findByLabelText('My registration link ¥0.06')
  ).toHaveValue(`${window.location.origin}/sign-up?invite=${existing.token}`)
  fireEvent.change(screen.getByLabelText(/CNY per image/), {
    target: { value: '0.02' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Generate link' }))
  expect(
    await screen.findByLabelText('My registration link ¥0.02')
  ).toHaveValue(`${window.location.origin}/sign-up?invite=${'b'.repeat(64)}`)
  expect(
    screen.getByLabelText('My registration link ¥0.06')
  ).toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0])
  await waitFor(() =>
    expect(clipboard).toHaveBeenCalledWith(
      `${window.location.origin}/sign-up?invite=${'b'.repeat(64)}`
    )
  )
  vi.unstubAllGlobals()
})

test('empty links explain creation and invalid prices disable generation', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
  mount(<AgentInvitations profile={profile} />)
  expect(
    await screen.findByText('Set a price and generate a registration link.')
  ).toBeInTheDocument()
  for (const value of ['0.01', '0.07', '0.025', '']) {
    fireEvent.change(screen.getByLabelText(/CNY per image/), {
      target: { value },
    })
    expect(screen.getByRole('button', { name: 'Generate link' })).toBeDisabled()
  }
  fireEvent.change(screen.getByLabelText(/CNY per image/), {
    target: { value: '0.06' },
  })
  expect(screen.getByRole('button', { name: 'Generate link' })).toBeEnabled()
})

test('a failed generation keeps existing links available and permits retry', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [existing] })
  vi.spyOn(api, 'post').mockRejectedValue(new Error('network unavailable'))
  mount(<AgentInvitations profile={profile} />)
  await screen.findByLabelText('My registration link ¥0.06')
  fireEvent.click(screen.getByRole('button', { name: 'Generate link' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Generate link' })).toBeEnabled()
  )
  expect(
    screen.getByLabelText('My registration link ¥0.06')
  ).toBeInTheDocument()
})

function RegistrationGate() {
  const invitation = useInvitationPreview('c'.repeat(64))
  return (
    <>
      <button type='button' disabled={invitation.blocked}>
        Register
      </button>
      <span>{invitation.query.data?.price_cents}</span>
    </>
  )
}
test('a live invitation enables registration at its offered price', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      model: 'gpt-image-2',
      price_cents: 2,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
    },
  })
  mount(<RegistrationGate />)
  expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled()
  )
  expect(screen.getByText('2')).toBeInTheDocument()
})
test('an expired invitation blocks registration even if a stale preview was returned', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      model: 'gpt-image-2',
      price_cents: 2,
      expires_at: Math.floor(Date.now() / 1000) - 1,
    },
  })
  mount(<RegistrationGate />)
  await screen.findByText('2')
  expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()
})
