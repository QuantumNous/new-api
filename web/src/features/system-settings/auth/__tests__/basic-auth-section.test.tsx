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
import { createInstance, type i18n } from 'i18next'
import { useState, type ComponentProps } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { BasicAuthSection } from '../basic-auth-section'

const defaults: ComponentProps<typeof BasicAuthSection>['defaultValues'] = {
  PasswordLoginEnabled: true,
  PasswordRegisterEnabled: true,
  DisableLocalRegistration: false,
  EmailVerificationEnabled: false,
  RegisterEnabled: true,
  EmailDomainRestrictionEnabled: false,
  EmailAliasRestrictionEnabled: false,
  EmailDomainWhitelist: '',
}

let testI18n: i18n

function Fixture(props: {
  values?: Partial<ComponentProps<typeof BasicAuthSection>['defaultValues']>
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  )

  return (
    <I18nextProvider i18n={testI18n}>
      <QueryClientProvider client={client}>
        <div ref={setContainer} />
        <SettingsPageProvider actionsContainer={container}>
          <BasicAuthSection
            defaultValues={{ ...defaults, ...props.values }}
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
    resources: { en: { translation: {} }, zh, 'zh-TW': zhTW },
    interpolation: { escapeValue: false },
  })
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

describe('Basic authentication settings', () => {
  it('saves the local registration switch independently', async () => {
    const user = userEvent.setup()
    render(<Fixture values={{ DisableLocalRegistration: true }} />)

    const toggle = screen.getByRole('switch', {
      name: 'Disable Local Registration',
    })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/api/option/', {
        key: 'DisableLocalRegistration',
        value: false,
      })
    )
    expect(api.put).toHaveBeenCalledTimes(1)
  })
})
