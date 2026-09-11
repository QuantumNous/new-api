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
// @vitest-environment-options {"url":"https://console.example.com:8443"}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance, type i18n } from 'i18next'
import { useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { PasskeySection } from '../passkey-section'

const defaults = {
  'passkey.enabled': true,
  'passkey.rp_display_name': 'Example',
  'passkey.rp_id': '',
  'passkey.origins': 'https://example.com,https://api.example.com',
  'passkey.allow_insecure_origin': false,
  'passkey.user_verification': 'preferred' as const,
  'passkey.attachment_preference': '' as const,
}

let testI18n: i18n

function Fixture(props: { rpId?: string; origins?: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
  )
  return (
    <I18nextProvider i18n={testI18n}>
      <QueryClientProvider client={client}>
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <PasskeySection
            defaultValues={{
              ...defaults,
              'passkey.rp_id': props.rpId ?? '',
              'passkey.origins': props.origins ?? defaults['passkey.origins'],
            }}
          />
        </SettingsPageProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

beforeEach(async () => {
  testI18n = createInstance()
  await testI18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} }, zh },
    interpolation: { escapeValue: false },
  })
  localStorage.clear()
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: { passkey_rp_id: window.location.hostname } },
  })
})

describe('Passkey website guidance', () => {
  it('shows the effective domain for a blank field without suggesting a change and restores focus', async () => {
    const put = vi.spyOn(api, 'put')
    const user = userEvent.setup()
    render(<Fixture />)
    const input = screen.getByRole('textbox', {
      name: 'Passkey website domain',
    })
    expect(input).toHaveValue('')
    await waitFor(() => expect(input).not.toHaveClass('border-amber-500'))
    expect(input).toHaveAccessibleDescription(
      `The system currently uses: ${window.location.hostname}`
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Passkeys only work on the website/)
    ).not.toBeInTheDocument()
    const help = screen.getByRole('button', { name: 'Why set this?' })
    help.focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', {
      name: 'Why set a website domain?',
    })
    expect(dialog).toHaveAccessibleDescription(
      'Passkeys only work on the website they were created for. This helps prevent other websites from misusing them.'
    )
    expect(
      await within(dialog).findByText(
        `The system currently uses: ${window.location.hostname}`
      )
    ).toBeVisible()
    expect(
      within(dialog).queryByText(/For this website, you can enter:/)
    ).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(help).toHaveFocus()
    expect(put).not.toHaveBeenCalled()
  })

  it('preserves an effective parent domain instead of replacing it with the current hostname', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: { passkey_rp_id: 'example.com' } },
    })
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Why set this?' }))
    await user.click(
      await screen.findByRole('button', { name: 'Keep existing domain' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    const input = screen.getByRole('textbox', {
      name: 'Passkey website domain',
    })
    expect(input).toHaveValue('example.com')
    expect(input).not.toHaveClass('border-amber-500')
    expect(
      screen.getByRole('textbox', { name: 'Allowed Passkey websites' })
    ).toHaveValue('https://example.com\nhttps://api.example.com')
    expect(put).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/option/', {
        key: 'passkey.rp_id',
        value: 'example.com',
      })
    )
    expect(put).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Why set this?' }))
    expect(
      await screen.findByText('The system currently uses: example.com')
    ).toBeVisible()
  })

  it('explains the effect on existing Passkeys and fills an empty website list including the port', async () => {
    const user = userEvent.setup()
    render(<Fixture origins='' />)
    await user.click(screen.getByRole('button', { name: 'Why set this?' }))
    expect(
      screen.getByText(
        'If users already have Passkeys, changing this domain may require them to sign in another way and set up their Passkeys again.'
      )
    ).toBeVisible()
    await user.click(
      await screen.findByRole('button', { name: 'Keep existing domain' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole('textbox', { name: 'Allowed Passkey websites' })
    ).toHaveValue(window.location.origin)
  })

  it.each([
    'unrelated.example.com',
    'ample.com',
    'https://console.example.com',
  ])(
    'marks mismatched domain %s in yellow and clears the warning when corrected',
    async (domain) => {
      const user = userEvent.setup()
      render(<Fixture rpId={window.location.hostname} />)
      const input = screen.getByRole('textbox', {
        name: 'Passkey website domain',
      })
      expect(input).not.toHaveClass('border-amber-500')
      await user.clear(input)
      await user.type(input, domain)
      expect(input).toHaveClass(
        'border-amber-500',
        'focus-visible:border-amber-500'
      )
      expect(input).toHaveAccessibleDescription(
        'This domain does not match the current website. Passkeys may not work here.'
      )
      await user.clear(input)
      await user.type(input, window.location.hostname)
      expect(input).not.toHaveClass('border-amber-500')
      expect(
        screen.queryByText(
          'This domain does not match the current website. Passkeys may not work here.'
        )
      ).not.toBeInTheDocument()
    }
  )

  it('keeps a matching parent domain unmarked and explains a missing website beside the website list', async () => {
    render(<Fixture rpId='example.com' />)
    expect(
      screen.getByRole('textbox', { name: 'Passkey website domain' })
    ).not.toHaveClass('border-amber-500')
    const websites = screen.getByRole('textbox', {
      name: 'Allowed Passkey websites',
    })
    expect(websites).toHaveAccessibleDescription(
      `This list does not include the current website. Add ${window.location.origin} if users sign in here.`
    )
    const user = userEvent.setup()
    await user.type(websites, `\n${window.location.origin}`)
    expect(websites).toHaveAccessibleDescription(
      'Enter one website address per line, such as https://example.com. Do not include a page path.'
    )
  })

  it('disables filling while saving and enables it after the save finishes', async () => {
    let finishSave!: (value: { data: { success: boolean } }) => void
    vi.spyOn(api, 'put').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve
        })
    )
    const user = userEvent.setup()
    render(<Fixture />)
    await user.type(
      screen.getByRole('textbox', { name: 'Passkey website domain' }),
      window.location.hostname
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await user.click(screen.getByRole('button', { name: 'Why set this?' }))
    const fill = screen.getByRole('button', { name: 'Keep existing domain' })
    expect(fill).toBeDisabled()
    finishSave({ data: { success: true } })
    await waitFor(() => expect(fill).toBeEnabled())
  })

  it('uses everyday Chinese in the field and explanation dialog', async () => {
    await testI18n.changeLanguage('zh')
    const user = userEvent.setup()
    render(<Fixture />)
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: '通行密钥使用的网站域名' })
      ).not.toHaveClass('border-amber-500')
    )
    await user.click(screen.getByRole('button', { name: '为什么需要设置？' }))
    const dialog = screen.getByRole('dialog', {
      name: '为什么要填写网站域名？',
    })
    expect(dialog).not.toHaveTextContent(/RP ID|Origins?|依赖方/)
    expect(
      within(dialog).getByRole('button', { name: '保留现有域名' })
    ).toBeVisible()
  })

  it('keeps manual setup available when the current system domain cannot be read', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Offline'))
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(screen.getByRole('button', { name: 'Why set this?' }))
    expect(
      await screen.findByText(
        'The current setting could not be loaded. You can still enter the website domain yourself.'
      )
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Fill in this website' })
    ).toBeEnabled()
  })

  it('requires confirmation before replacing an automatically resolved domain and lets users cancel', async () => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = userEvent.setup()
    render(<Fixture />)
    const input = screen.getByRole('textbox', {
      name: 'Passkey website domain',
    })
    await waitFor(() =>
      expect(input).toHaveAccessibleDescription(
        `The system currently uses: ${window.location.hostname}`
      )
    )
    await user.type(input, 'example.com')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = screen.getByRole('alertdialog', {
      name: 'Change the Passkey domain?',
    })
    expect(dialog).toHaveTextContent(
      `Current domain: ${window.location.hostname}`
    )
    expect(dialog).toHaveTextContent('New domain: example.com')
    expect(put).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(put).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await user.click(screen.getByRole('button', { name: 'Change domain' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledExactlyOnceWith('/api/option/', {
        key: 'passkey.rp_id',
        value: 'example.com',
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    )
  })

  it('warns before clearing an explicit domain back to automatic configuration', async () => {
    const put = vi.spyOn(api, 'put')
    const user = userEvent.setup()
    render(<Fixture rpId='example.com' />)
    await user.clear(
      screen.getByRole('textbox', { name: 'Passkey website domain' })
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    const dialog = screen.getByRole('alertdialog', {
      name: 'Change the Passkey domain?',
    })
    expect(dialog).toHaveTextContent('Current domain: example.com')
    expect(dialog).toHaveTextContent(
      'New domain: Automatic from system website address'
    )
    expect(put).not.toHaveBeenCalled()
  })

  it('still requires confirmation if the effective domain cannot be loaded', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Offline'))
    const put = vi.spyOn(api, 'put')
    const user = userEvent.setup()
    render(<Fixture />)
    await user.type(
      screen.getByRole('textbox', { name: 'Passkey website domain' }),
      'example.com'
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(
      screen.getByRole('alertdialog', { name: 'Change the Passkey domain?' })
    ).toHaveTextContent('Current domain: Unknown')
    expect(put).not.toHaveBeenCalled()
  })

  it('keeps a failed domain change available for retry without an unhandled rejection', async () => {
    const put = vi.spyOn(api, 'put').mockRejectedValueOnce(new Error('Offline'))
    const user = userEvent.setup()
    render(<Fixture rpId={window.location.hostname} />)
    const input = screen.getByRole('textbox', {
      name: 'Passkey website domain',
    })
    await user.clear(input)
    await user.type(input, 'example.com')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await user.click(screen.getByRole('button', { name: 'Change domain' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Change domain' })
      ).toBeEnabled()
    )
    put.mockResolvedValue({ data: { success: true } })
    await user.click(screen.getByRole('button', { name: 'Change domain' }))
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    )
    expect(put).toHaveBeenCalledTimes(2)
  })
})
