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

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: (name: string) => <span title={name} />,
}))
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

it('shows MiMo Code with its Xiaomi MiMo brand icon', async () => {
  render(
    <ClientIdentity
      client={{
        ...client,
        client_key: 'mimocode:desktop',
        family: 'mimocode',
        variant: 'desktop',
        display_name: 'MiMo Code Desktop',
        version: 'bdfe497',
      }}
    />
  )
  expect(
    screen.getByRole('button', { name: 'MiMo Code Desktop' })
  ).toBeVisible()
  expect(await screen.findByTitle('XiaomiMiMo')).toBeInTheDocument()
})

it.each([
  ['changzheng', 'changzheng'],
  ['greyfield', 'greyfield'],
  ['taffyofficial', 'taffyOfficial'],
])('shows the dedicated portrait for %s', (family, name) => {
  render(<ClientIdentity client={{ ...client, family, display_name: name }} />)
  const button = screen.getByRole('button', { name })
  const portrait = button.querySelector('img')
  expect(portrait).toHaveAttribute(
    'src',
    expect.stringContaining(`${name}.webp`)
  )
  expect(portrait).toHaveAttribute('aria-hidden', 'true')
  expect(portrait).toHaveAttribute('width', '28')
})

it('opens client details with keyboard, copies only UA and returns focus on escape', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  render(<ClientIdentity client={client} />)
  const trigger = screen.getByRole('button', {
    name: 'Codex Desktop',
  })
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

it('shows only the parsed product name and preserves its version and original UA', async () => {
  const user = userEvent.setup()
  render(
    <ClientIdentity
      client={{
        ...client,
        family: 'unknown',
        display_name: 'MyTool',
        confidence: 'unverified',
        version: '1.2',
        user_agent: 'MyTool/1.2',
      }}
    />
  )
  expect(screen.queryByText('Unverified client')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /MyTool/ }))
  expect(screen.getByText('MyTool/1.2')).toBeVisible()
  expect(screen.getByText('1.2')).toBeVisible()
  expect(screen.queryByText('Recognized identifier')).not.toBeInTheDocument()
})

it('keeps a parsed name while translating its details into Chinese', async () => {
  const instance = createInstance()
  await instance.init({ lng: 'zh', resources: { en, zh } })
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={instance}>
      <ClientIdentity
        client={{
          ...client,
          family: 'unknown',
          confidence: 'unverified',
          display_name: 'MyTool',
        }}
      />
    </I18nextProvider>
  )
  await user.click(screen.getByRole('button', { name: 'MyTool' }))
  expect(screen.getByText('名称解析')).toBeVisible()
  expect(screen.queryByText('未验证客户端')).not.toBeInTheDocument()
})
