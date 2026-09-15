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

import { buildUsageReportCsv } from '../report-export'

const original = useSystemConfigStore.getState().config
const rows = [{ date: '2026-09-08', requests: 101, tokens: 510, quota: 500000 }]
afterEach(() => useSystemConfigStore.setState({ config: original }))
describe('usage CSV money', () => {
  it('exports CNY numeric amounts and an explicit unit matching the report', () => {
    useSystemConfigStore.setState({
      config: {
        ...original,
        currency: {
          ...original.currency,
          quotaDisplayType: 'CNY',
          quotaPerUnit: 500000,
          usdExchangeRate: 7,
        },
      },
    })
    expect(buildUsageReportCsv(rows)).toBe(
      'Date,Requests,Tokens,Billed (CNY)\n2026-09-08,101,510,7\n'
    )
  })
  it('labels token-only export as quota instead of money', () => {
    useSystemConfigStore.setState({
      config: {
        ...original,
        currency: { ...original.currency, quotaDisplayType: 'TOKENS' },
      },
    })
    expect(buildUsageReportCsv(rows)).toContain(
      'Quota (tokens)\n2026-09-08,101,510,500000'
    )
  })
})
