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
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { formatQuotaAsCNY, parseQuotaFromCNY, quotaUnitsToCNY } from './format'

const originalConfig = useSystemConfigStore.getState().config

afterEach(() => {
  useSystemConfigStore.setState({ config: originalConfig })
})

describe('fixed CNY quota conversion', () => {
  test('does not follow the site quota display mode', () => {
    useSystemConfigStore.setState({
      config: {
        ...originalConfig,
        currency: {
          ...originalConfig.currency,
          quotaDisplayType: 'TOKENS',
          quotaPerUnit: 500_000,
          usdExchangeRate: 7.3,
        },
      },
    })

    assert.equal(parseQuotaFromCNY(7.3), 500_000)
    assert.equal(quotaUnitsToCNY(500_000), 7.3)
    assert.equal(formatQuotaAsCNY(500_000, 'en-US'), '¥7.30')
  })
})
