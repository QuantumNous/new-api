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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'

import { UserQuotaDialog } from '../user-quota-dialog'

const FSI = '⁨'
const PDI = '⁩'

async function renderOverridePreview() {
  render(
    <UserQuotaDialog
      open
      onOpenChange={() => undefined}
      userId={1}
      currentQuota={500_000}
      onSuccess={() => undefined}
    />
  )
  await userEvent.click(screen.getByRole('button', { name: 'Override' }))
  await userEvent.type(screen.getByRole('spinbutton'), '2')
  return screen.getByText(/^Current quota: /)
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('user quota override preview', () => {
  it('in English, joins the current and new quota with a right arrow', async () => {
    await i18next.changeLanguage('en')
    const preview = await renderOverridePreview()

    expect(preview.textContent).toMatch(/^Current quota: \S+ → \S+$/)
  })

  it('in Persian, isolates both quotas and points the arrow to the left', async () => {
    await i18next.changeLanguage('fa')
    const preview = await renderOverridePreview()

    expect(preview.textContent).toMatch(
      new RegExp(`: ${FSI}[^${PDI}]+${PDI} ← ${FSI}[^${PDI}]+${PDI}$`)
    )
  })
})
