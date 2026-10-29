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
import { describe, expect, it, vi } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'

import { buildQuotaAuditOperation } from '../quota-audit-operation'

const t = (key: string, options?: Record<string, unknown>): string =>
  key.replaceAll(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''))

// Default currency config: 500000 quota units = 1 USD.
const params = { requested_quota: 1_000_000, from: 500_000, to: 1_000_000 }

describe('quota audit amounts', () => {
  it('in Persian, writes the amounts with Persian digits', () => {
    const result = buildQuotaAuditOperation(
      'user.quota_override',
      params,
      true,
      t,
      toIntlLocale('fa')
    )
    expect(result?.description).toContain('۲')
    expect(result?.description).not.toMatch(/\$2\b/)
  })

  it('in English, keeps the amounts in the runtime default locale', () => {
    // Pin the runtime default so the expected amount does not depend on the
    // machine's locale.
    const NumberFormat = Intl.NumberFormat
    vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (
      locales?: Intl.LocalesArgument,
      options?: Intl.NumberFormatOptions
    ) {
      return new NumberFormat(locales ?? 'en-US', options)
    } as typeof Intl.NumberFormat)

    const result = buildQuotaAuditOperation(
      'user.quota_override',
      params,
      true,
      t,
      toIntlLocale('en')
    )
    expect(result?.description).toMatch(/\$2$/)
  })
})
