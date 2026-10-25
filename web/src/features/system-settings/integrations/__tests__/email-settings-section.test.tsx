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
import { useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { createEmailSchema } from '../email-settings-schema'
import { EmailSettingsSection } from '../email-settings-section'

type EmailValues = ComponentProps<typeof EmailSettingsSection>['defaultValues']
const defaults: EmailValues = {
  QuotaRemindEnabled: true,
  QuotaRemindThreshold: '0',
  EmailProvider: 'smtp',
  ResendApiKey: '',
  ResendKeyConfigured: true,
  ResendFrom: 'notify@example.com',
  SMTPServer: 'smtp.example.com',
  SMTPPort: '587',
  SMTPAccount: 'sender@example.com',
  SMTPFrom: 'sender@example.com',
  SMTPToken: '',
  SMTPSSLEnabled: false,
  SMTPStartTLSEnabled: true,
  SMTPInsecureSkipVerify: false,
  SMTPForceAuthLogin: false,
}

function EmailFixture(props: { values: EmailValues }) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <SettingsPageProvider actionsContainer={actions}>
      <div ref={setActions} />
      <EmailSettingsSection defaultValues={props.values} />
    </SettingsPageProvider>
  )
}
function renderEmail(values: Partial<EmailValues> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <EmailFixture values={{ ...defaults, ...values }} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}
afterEach(() => vi.restoreAllMocks())

describe('email delivery settings', () => {
  it('keeps balance notifications editable when Resend is selected', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({ EmailProvider: 'resend' })
    expect(
      screen.getByRole('textbox', { name: 'Sender email address' })
    ).toBeVisible()
    await user.click(
      screen.getByRole('switch', { name: 'Low balance reminder' })
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/api/option/', {
        key: 'QuotaRemindEnabled',
        value: false,
      })
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('requires a key before first activating Resend and does not disable SMTP', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({ ResendKeyConfigured: false })
    await user.click(screen.getByRole('radio', { name: 'Resend API' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(
      await screen.findByText(
        'Configure a Resend API key before enabling Resend'
      )
    ).toBeVisible()
    expect(request).not.toHaveBeenCalled()
  })

  it('selects only one provider, hides inactive fields and retains SMTP drafts when switching back', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail()
    const host = screen.getByRole('textbox', { name: 'SMTP Host' })
    await user.clear(host)
    await user.type(host, 'draft.smtp.example.com')
    await user.click(screen.getByRole('radio', { name: 'Resend API' }))
    expect(screen.getByRole('radio', { name: 'Resend API' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'SMTP' })).not.toBeChecked()
    expect(
      screen.queryByRole('textbox', { name: 'SMTP Host' })
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Resend API key')).toHaveAttribute(
      'type',
      'password'
    )
    await user.click(screen.getByRole('radio', { name: 'SMTP' }))
    expect(screen.getByRole('textbox', { name: 'SMTP Host' })).toHaveValue(
      'draft.smtp.example.com'
    )
    expect(screen.queryByLabelText('Resend API key')).not.toBeInTheDocument()
    expect(request).not.toHaveBeenCalled()
  })

  it('saves Resend credentials before activating it and ignores invalid inactive SMTP fields', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({
      ResendKeyConfigured: false,
      SMTPPort: 'invalid',
      SMTPFrom: 'invalid',
    })
    await user.click(screen.getByRole('radio', { name: 'Resend API' }))
    const from = screen.getByRole('textbox', { name: 'Sender email address' })
    await user.clear(from)
    await user.type(from, 'mail@example.com')
    await user.type(
      screen.getByRole('textbox', { name: 'Sender name' }),
      'New API'
    )
    await user.type(screen.getByLabelText('Resend API key'), 'test-key')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    expect(request.mock.calls.map((call) => call[1])).toEqual([
      { key: 'ResendFrom', value: '"New API" <mail@example.com>' },
      { key: 'ResendApiKey', value: 'test-key' },
      { key: 'EmailProvider', value: 'resend' },
    ])
    await waitFor(() =>
      expect(screen.getByLabelText('Resend API key')).toHaveValue('')
    )
  })

  it('keeps a saved Resend key when its input is blank', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({ EmailProvider: 'resend' })
    const from = screen.getByRole('textbox', { name: 'Sender email address' })
    await user.clear(from)
    await user.type(from, 'changed@example.com')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(request).toHaveBeenCalledWith('/api/option/', {
      key: 'ResendFrom',
      value: 'changed@example.com',
    })
  })

  it('retains both Resend sender drafts when switching providers', async () => {
    const user = renderEmail({ EmailProvider: 'resend' })
    const from = screen.getByRole('textbox', { name: 'Sender email address' })
    await user.clear(from)
    await user.type(from, 'notify@another.example')
    await user.type(
      screen.getByRole('textbox', { name: 'Sender name' }),
      'New API 通知'
    )
    await user.click(screen.getByRole('radio', { name: 'SMTP' }))
    expect(
      screen.queryByRole('textbox', { name: 'Sender name' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Resend API' }))
    expect(
      screen.getByRole('textbox', { name: 'Sender email address' })
    ).toHaveValue('notify@another.example')
    expect(screen.getByRole('textbox', { name: 'Sender name' })).toHaveValue(
      'New API 通知'
    )
  })

  it('switches back to SMTP without clearing or updating Resend credentials', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({ EmailProvider: 'resend' })
    await user.click(screen.getByRole('radio', { name: 'SMTP' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(request).toHaveBeenCalledWith('/api/option/', {
      key: 'EmailProvider',
      value: 'smtp',
    })
  })

  it('does not activate Resend if saving its credential fails', async () => {
    const request = vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: false, message: 'Credential save rejected' },
    })
    const user = renderEmail()
    await user.click(screen.getByRole('radio', { name: 'Resend API' }))
    await user.type(screen.getByLabelText('Resend API key'), 'test-key')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    )
    expect(request.mock.calls.map((call) => call[1])).toEqual([
      { key: 'ResendApiKey', value: 'test-key' },
    ])
  })

  it('rejects an empty Resend sender without submitting settings', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({ EmailProvider: 'resend', ResendFrom: '' })
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(
      await screen.findByText('Enter a valid sender email address')
    ).toBeVisible()
    expect(request).not.toHaveBeenCalled()
  })

  it('supports changing the provider with the keyboard', async () => {
    const user = renderEmail()
    await user.click(screen.getByRole('radio', { name: 'SMTP' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Resend API' })).toBeChecked()
    expect(
      screen.getByRole('textbox', { name: 'Sender email address' })
    ).toBeVisible()
  })

  it('loads a legacy named sender into two fields without changing saved settings', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({
      EmailProvider: 'resend',
      ResendFrom: 'New API <notify@example.com>',
    })
    expect(
      screen.getByRole('textbox', { name: 'Sender email address' })
    ).toHaveValue('notify@example.com')
    expect(screen.getByRole('textbox', { name: 'Sender name' })).toHaveValue(
      'New API'
    )
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(request).not.toHaveBeenCalled()
  })

  it('round-trips quoted sender names and allows clearing the name', async () => {
    const request = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    const user = renderEmail({
      EmailProvider: 'resend',
      ResendFrom: '"New API, \\"Mail\\"" <notify@example.com>',
    })
    const name = screen.getByRole('textbox', { name: 'Sender name' })
    expect(name).toHaveValue('New API, "Mail"')
    await user.clear(name)
    await user.type(name, 'New API, "Support"')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith('/api/option/', {
        key: 'ResendFrom',
        value: '"New API, \\"Support\\"" <notify@example.com>',
      })
    )
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith('/api/option/', {
        key: 'ResendFrom',
        value: 'notify@example.com',
      })
    )
  })

  it.each(['notify', 'New API <notify@example.com>'])(
    'rejects %s instead of a complete standalone sender email',
    async (address) => {
      const request = vi
        .spyOn(api, 'put')
        .mockResolvedValue({ data: { success: true } })
      const user = renderEmail({ EmailProvider: 'resend' })
      const from = screen.getByRole('textbox', { name: 'Sender email address' })
      await user.clear(from)
      await user.type(from, address)
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(
        await screen.findByText('Enter a valid sender email address')
      ).toBeVisible()
      expect(request).not.toHaveBeenCalled()
    }
  )

  it('validates provider values on the form boundary', () => {
    expect(
      createEmailSchema((key) => key).safeParse({
        ...defaults,
        ResendSenderName: '',
        EmailProvider: 'both',
      }).success
    ).toBe(false)
  })

  it('rejects line breaks in a Resend sender name', () => {
    const parsed = createEmailSchema((key) => key).safeParse({
      ...defaults,
      EmailProvider: 'resend',
      ResendSenderName: 'New API\r\nBcc: other@example.com',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues).toEqual([
        expect.objectContaining({ path: ['ResendSenderName'] }),
      ])
    }
  })
})
