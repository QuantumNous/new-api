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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import { ClientIdentity, type ClientSnapshot } from '../client-identity'

vi.mock('@lobehub/icons', () => ({ Codex: undefined, NewAPI: undefined }))
afterEach(cleanup)
const client: ClientSnapshot = {
  client_key: 'codex:desktop',
  family: 'codex',
  variant: 'desktop',
  display_name: 'Codex Desktop',
  version: '0.155.0-alpha.9',
  confidence: 'identified',
  user_agent: 'Codex Desktop/0.155.0-alpha.9 (Windows)',
  truncated: false,
}

it('shows historical missing metadata as not recorded without guessing a client', () => {
  render(<ClientIdentity />)
  expect(screen.getByText('Not recorded')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('opens client details with keyboard, copies only UA and returns focus on escape', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  render(<ClientIdentity client={client} />)
  const trigger = screen.getByRole('button', { name: 'Codex Desktop' })
  await user.tab()
  expect(trigger).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(await screen.findByText(client.user_agent)).toBeInTheDocument()
  expect(screen.getByText('desktop')).toBeInTheDocument()
  expect(screen.getByText(client.version)).toBeInTheDocument()
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await user.click(screen.getByRole('button', { name: 'Copy User-Agent' }))
  expect(write).toHaveBeenCalledWith(client.user_agent)
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  expect(trigger).toHaveFocus()
})

it('shows the Go inference and truncation notices with responsive long UA text', async () => {
  const user = userEvent.setup()
  render(
    <ClientIdentity
      client={{
        ...client,
        family: 'newapi',
        display_name: 'NewAPI',
        confidence: 'inferred',
        user_agent: 'x'.repeat(2048),
        truncated: true,
      }}
    />
  )
  await user.click(screen.getByRole('button', { name: 'NewAPI' }))
  expect(await screen.findByText(/Generic Go UA inference/)).toBeInTheDocument()
  expect(
    screen.getByText('User-Agent truncated to 2048 bytes')
  ).toBeInTheDocument()
  expect(screen.getByText('x'.repeat(2048))).toHaveClass(
    'whitespace-pre-wrap',
    'wrap-anywhere'
  )
  expect(screen.getByRole('dialog')).toHaveClass('max-w-[calc(100vw-24px)]')
})

it('updates unknown client and detail copy when the language changes', async () => {
  const instance = createInstance()
  await instance.init({ lng: 'en', resources: { en, zh } })
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={instance}>
      <ClientIdentity
        client={{ ...client, family: 'unknown', confidence: 'unknown' }}
      />
    </I18nextProvider>
  )
  await user.click(screen.getByRole('button', { name: 'Unknown client' }))
  await instance.changeLanguage('zh')
  expect(
    await screen.findByRole('button', { name: '未知客户端' })
  ).toBeInTheDocument()
  expect(screen.getByText('识别来源')).toBeInTheDocument()
})
