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
import { afterEach, describe, expect, it } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { buildSavingsCatalog, formatPerMillionTokens } from '../pricing-savings'

const original = useSystemConfigStore.getState().config

afterEach(() => useSystemConfigStore.setState({ config: original }))

describe('recharge price display', () => {
  it('formats a price already converted by the recharge rate exactly once', () => {
    useSystemConfigStore.setState({
      config: {
        ...original,
        currency: {
          ...original.currency,
          quotaDisplayType: 'CNY',
          usdExchangeRate: 7,
        },
      },
    })
    const [model] = buildSavingsCatalog(
      [
        {
          id: 1,
          model_name: 'demo',
          quota_type: 0,
          model_ratio: 1,
          completion_ratio: 2,
          enable_groups: ['half'],
          group_ratio: { half: 0.5 },
        },
      ],
      7
    )
    expect(formatPerMillionTokens(model.siteInputPrice)).toBe('¥7/M')
  })
  it('shows an explicit zero price instead of a missing price', () => {
    useSystemConfigStore.setState({
      config: {
        ...original,
        currency: { ...original.currency, quotaDisplayType: 'CNY' },
      },
    })
    expect(formatPerMillionTokens(0)).toBe('¥0/M')
    expect(formatPerMillionTokens(Number.NaN)).toBe('—')
  })

  it.each(['USD', 'TOKENS', 'CUSTOM'] as const)(
    'keeps catalog amounts in CNY when quota display type is %s',
    (quotaDisplayType) => {
      useSystemConfigStore.setState({
        config: {
          ...original,
          currency: { ...original.currency, quotaDisplayType },
        },
      })

      expect(formatPerMillionTokens(13.5)).toBe('¥13.5/M')
    }
  )
})
