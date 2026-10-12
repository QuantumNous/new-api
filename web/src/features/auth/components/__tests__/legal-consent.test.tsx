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
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'

import { LegalConsent } from '../legal-consent'

const status = {
  user_agreement_enabled: true,
  privacy_policy_enabled: true,
}

function renderConsent() {
  return render(
    <LegalConsent status={status} checked={false} onCheckedChange={() => {}} />
  )
}

describe('LegalConsent', () => {
  afterEach(async () => {
    await i18next.changeLanguage('en')
  })

  it('aligns the consent text to the inline start so it follows RTL', () => {
    renderConsent()

    const label = screen
      .getByText('I have read and agree to the', {
        exact: false,
      })
      .closest('label')
    expect(label).toHaveClass('text-start')
    expect(label).not.toHaveClass('text-left')
  })
})
