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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { expect, it, vi } from 'vitest'

import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'

import { TwoFASetupDialog } from '../dialogs/two-fa-setup-dialog'

const setupData = {
  secret: 'JBSWY3DPEHPK3PXP',
  qr_code_data: 'otpauth://totp/test?secret=JBSWY3DPEHPK3PXP',
  backup_codes: ['AAAA-BBBB'],
  flow_token: 'flow',
  expires_at: 0,
}

async function renderDialog(lng: 'en' | 'zhCN') {
  const i18n = createInstance()
  await i18n.init({
    lng,
    fallbackLng: 'en',
    nsSeparator: false,
    interpolation: { escapeValue: false },
    resources: { en, zhCN: zh },
    initAsync: false,
  })
  render(
    <I18nextProvider i18n={i18n}>
      <TwoFASetupDialog
        open
        setupData={setupData}
        loading={false}
        initializing={false}
        onCancel={vi.fn()}
        onEnable={vi.fn()}
      />
    </I18nextProvider>
  )
}

it('describes the first setup step as a spaced sentence in English', async () => {
  await renderDialog('en')

  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
    'Step 1 of 3: Scan QR Code'
  )
})

it('describes the first setup step in natural Simplified Chinese order', async () => {
  await renderDialog('zhCN')

  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
    '第 1 步，共 3 步：扫描二维码'
  )
})

it('updates the step number and label after moving to the next step', async () => {
  await renderDialog('en')

  await userEvent.click(screen.getByRole('button', { name: 'Next' }))

  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
    'Step 2 of 3: Save Backup Codes'
  )
})
