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
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { formatChannelBalance } from '../channel-balance'

describe('account balance formatting', () => {
  const initialState = useSystemConfigStore.getState()
  const originalStorage = useSystemConfigStore.persist.getOptions().storage
  beforeEach(() => {
    useSystemConfigStore.persist.setOptions({
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    })
  })
  afterEach(() => {
    useSystemConfigStore.setState(initialState, true)
    useSystemConfigStore.persist.setOptions({ storage: originalStorage })
  })
  it('shows the upstream CNY wallet without applying the site exchange rate', () => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...initialState.config.currency,
        quotaDisplayType: 'CNY',
        usdExchangeRate: 7,
      },
    })
    expect(formatChannelBalance(99.89, 'CNY', { locale: 'en-US' })).toBe(
      '¥99.89'
    )
  })
  it('preserves zero as a successfully queried balance', () => {
    expect(formatChannelBalance(0, 'USD', { locale: 'en-US' })).toBe('$0.00')
  })
  it('keeps the currency visible in a compact channel card', () => {
    expect(
      formatChannelBalance(99000, 'CNY', {
        locale: 'en-US',
        compact: true,
        showSymbol: false,
      })
    ).toContain('¥')
  })
})
