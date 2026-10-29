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
import { cleanup, render, screen } from '@testing-library/react'
import { useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { SettingsPageProvider } from '../../components/settings-page-context'
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
      <div dir='rtl'>
        <EmailFixture values={{ ...defaults, ...values }} />
      </div>
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
})

// Hosts and addresses read left to right on a right-to-left page.
describe('email settings field direction', () => {
  it.each(['SMTP Host', 'Username', 'From Address'])(
    'keeps the SMTP field %s left to right on a right-to-left page',
    (name) => {
      renderEmail()

      expect(screen.getByRole('textbox', { name })).toHaveAttribute(
        'dir',
        'ltr'
      )
    }
  )

  it('keeps the Resend sender email address input left to right on a right-to-left page', () => {
    renderEmail({ EmailProvider: 'resend' })

    expect(
      screen.getByRole('textbox', { name: 'Sender email address' })
    ).toHaveAttribute('dir', 'ltr')
  })
})
