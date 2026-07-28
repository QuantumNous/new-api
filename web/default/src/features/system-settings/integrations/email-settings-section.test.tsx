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
import { beforeAll, describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import {
  EmailSettingsSection,
  buildEmailOptionUpdates,
  parseSMTPFromAliases,
  type EmailFormValues,
} from './email-settings-section'

const i18n = createInstance()

const defaultEmailValues: EmailFormValues = {
  SMTPServer: '',
  SMTPPort: '',
  SMTPAccount: '',
  SMTPFrom: 'noreply@example.com',
  SMTPFromAliases: '',
  SMTPToken: '',
  SMTPSSLEnabled: false,
  SMTPForceAuthLogin: false,
}

describe('SMTP email settings', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: {} } },
      interpolation: { escapeValue: false },
    })
  })

  test('parses one plain sender alias per line and preserves first spelling', () => {
    expect(
      parseSMTPFromAliases(
        ' Sales@Example.com \rsupport@example.com\r\n\nops@example.com ',
        'noreply@example.com'
      )
    ).toEqual({
      aliases: ['Sales@Example.com', 'support@example.com', 'ops@example.com'],
      persisted: 'Sales@Example.com,support@example.com,ops@example.com',
    })
  })

  test('rejects malformed aliases and display-name addresses', () => {
    expect(() =>
      parseSMTPFromAliases('Sales <sales@example.com>', 'noreply@example.com')
    ).toThrow('Each alias must be a plain email address.')

    expect(() =>
      parseSMTPFromAliases('sales@example.com\nBcc: bad@example.com', '')
    ).toThrow('Each alias must be a plain email address.')
  })

  test('rejects case-insensitive duplicate aliases', () => {
    expect(() =>
      parseSMTPFromAliases('Sales@example.com\nsales@EXAMPLE.com', '')
    ).toThrow('Sender aliases must be unique.')
  })

  test('rejects aliases matching the configured From address', () => {
    expect(() =>
      parseSMTPFromAliases('NOREPLY@example.com', 'noreply@example.com')
    ).toThrow('Sender aliases must not duplicate the From address.')
  })

  test('renders the allowed From aliases textarea with provider guidance', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <EmailSettingsSection
            defaultValues={{
              ...defaultEmailValues,
              SMTPFromAliases: 'sales@example.com\nsupport@example.com',
            }}
          />
        </QueryClientProvider>
      </I18nextProvider>
    )

    expect(html).toContain('Allowed From aliases')
    expect(html).toContain('Enter one authorized email address per line.')
    expect(html).toContain(
      'Aliases must already be authorized by your SMTP provider.'
    )
    expect(html).toContain('sales@example.com')
    expect(html).toContain('support@example.com')
  })

  test('normalizes aliases to the persisted option when saving', () => {
    const updates = buildEmailOptionUpdates(
      {
        ...defaultEmailValues,
        SMTPFromAliases: 'sales@example.com',
      },
      {
        ...defaultEmailValues,
        SMTPFromAliases: ' Sales@Example.com \n support@example.com ',
      }
    )

    expect(updates).toEqual([
      {
        key: 'SMTPFromAliases',
        value: 'Sales@Example.com,support@example.com',
      },
    ])
  })

  test('updates From before aliases when both sender settings change', () => {
    const updates = buildEmailOptionUpdates(defaultEmailValues, {
      ...defaultEmailValues,
      SMTPFrom: 'sender@example.com',
      SMTPFromAliases: 'sales@example.com',
    })

    expect(updates.map((update) => update.key)).toEqual([
      'SMTPFrom',
      'SMTPFromAliases',
    ])
  })

  test('does not overwrite an existing token with a blank form value', () => {
    const updates = buildEmailOptionUpdates(
      {
        ...defaultEmailValues,
        SMTPToken: 'existing-secret',
      },
      {
        ...defaultEmailValues,
        SMTPToken: '   ',
        SMTPSSLEnabled: true,
      }
    )

    expect(updates).toEqual([{ key: 'SMTPSSLEnabled', value: true }])
  })
})
