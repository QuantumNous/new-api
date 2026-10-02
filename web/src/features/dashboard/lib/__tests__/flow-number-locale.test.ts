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
import { describe, expect, it } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'

import type { FlowQuotaDataItem } from '../../types'
import { buildDashboardFlowData, buildFlowSankeySpec } from '../flow'

const rows: FlowQuotaDataItem[] = [
  {
    user_id: 1,
    username: 'alice',
    use_group: 'vip',
    channel_id: 101,
    channel_name: 'east',
    model_name: 'gpt-4.1',
    quota: 1250,
    token_used: 40,
    count: 2,
  },
]

type TooltipLine = {
  key: string
  value: (datum: Record<string, unknown>) => string
}

function tooltipLines(locale: Intl.LocalesArgument): TooltipLine[] {
  const flow = buildDashboardFlowData(rows, 'quota', { locale }).flow
  const spec = buildFlowSankeySpec(flow, 'Flow', String, undefined, locale)
  return spec.tooltip.mark.content as TooltipLine[]
}

function lineValue(
  locale: Intl.LocalesArgument,
  key: string,
  datum: Record<string, unknown>
) {
  const line = tooltipLines(locale).find((item) => item.key === key)
  return line?.value(datum)
}

describe('dashboard flow numbers', () => {
  it('in English, keeps the user filter value with grouping', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      locale: toIntlLocale('en'),
    })
    expect(result.filterOptions.users[0].valueLabel).toBe('1,250')
  })

  it('in Persian, writes the user filter value with Persian digits', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      locale: toIntlLocale('fa'),
    })
    expect(result.filterOptions.users[0].valueLabel).toBe('۱٬۲۵۰')
  })

  it('in Persian, writes the node filter values with Persian digits', () => {
    const result = buildDashboardFlowData(rows, 'quota', {
      locale: toIntlLocale('fa'),
    })
    expect(result.filterOptions.nodes[0].valueLabel).toBe('۱٬۲۵۰')
  })

  it('in English, keeps the tooltip share and request count as before', () => {
    const datum = { share: 0.4567, requests: 1234 }
    expect(lineValue(toIntlLocale('en'), 'Share', datum)).toBe('45.7%')
    expect(lineValue(toIntlLocale('en'), 'Requests', datum)).toBe('1,234')
  })

  it('in Persian, writes the tooltip share and request count with Persian digits', () => {
    const datum = { share: 0.4567, requests: 1234 }
    expect(lineValue(toIntlLocale('fa'), 'Share', datum)).toBe('۴۵٫۷٪')
    expect(lineValue(toIntlLocale('fa'), 'Requests', datum)).toBe('۱٬۲۳۴')
  })
})
