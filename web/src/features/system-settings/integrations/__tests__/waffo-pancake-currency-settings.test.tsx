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
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import {
  WaffoPancakeSettingsSection,
  type WaffoPancakeSettingsValues,
} from '../waffo-pancake-settings-section'

vi.mock('../waffo-pancake-api', () => ({
  createWaffoPancakePair: vi.fn(),
  listWaffoPancakeCatalog: vi.fn(),
}))

const defaultValues: WaffoPancakeSettingsValues = {
  WaffoPancakeMerchantID: '',
  WaffoPancakePrivateKey: '',
  WaffoPancakeReturnURL: '',
  WaffoPancakeCurrency: 'USD',
  WaffoPancakeUnitPrice: 1,
  WaffoPancakeMinTopUp: 1,
}

function SettingsHarness(props: { initialCurrency: string }) {
  const [values, setValues] = useState<WaffoPancakeSettingsValues>({
    ...defaultValues,
    WaffoPancakeCurrency: props.initialCurrency,
  })

  return (
    <WaffoPancakeSettingsSection
      defaultValues={defaultValues}
      values={values}
      onValueChange={(key, value) =>
        setValues((previous) => ({ ...previous, [key]: value }))
      }
      selectedBinding={{ storeID: '', productID: '' }}
      savedBinding={{ storeID: '', productID: '' }}
      onSelectedBindingChange={() => undefined}
    />
  )
}

describe('Waffo Pancake wallet currency settings', () => {
  test('defaults new wallet product creation and rate semantics to USD', () => {
    render(<SettingsHarness initialCurrency='' />)

    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(
      screen.getByText('Pancake exchange rate (USD per wallet USD)')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Amount charged in the selected Pancake currency for each USD of wallet balance, before group ratios and amount discounts. This setting is independent from the Epay Price field.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Smallest wallet balance amount a user can purchase through Pancake. This setting is independent from the Epay Minimum top-up field.'
      )
    ).toBeInTheDocument()
  })

  test('renders CNY wallet product creation and rate semantics independently', () => {
    render(<SettingsHarness initialCurrency='CNY' />)

    const currencyTrigger = screen.getAllByRole('combobox')[0]
    expect(currencyTrigger).toHaveTextContent('CNY')
    expect(
      screen.getByText('Pancake exchange rate (CNY per wallet USD)')
    ).toBeInTheDocument()
  })
})
