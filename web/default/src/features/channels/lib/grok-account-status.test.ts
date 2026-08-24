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
import { describe, expect, it } from 'bun:test'
import {
  getGrokQuotaPercent,
  formatGrokAccountStatus,
} from './grok-account-status'

describe('Grok account status presentation', () => {
  it('prefers used_percent and clamps the progress value to 0..100', () => {
    expect(getGrokQuotaPercent({ used_percent: 125, usage_percent: 40 })).toBe(
      100
    )
    expect(getGrokQuotaPercent({ used_percent: -5 })).toBe(0)
    expect(getGrokQuotaPercent({ usage_percent: 35 })).toBe(35)
  })

  it('returns null for missing or non-finite upstream usage', () => {
    expect(getGrokQuotaPercent(undefined)).toBeNull()
    expect(getGrokQuotaPercent({})).toBeNull()
    expect(getGrokQuotaPercent({ usage_percent: Number.NaN })).toBeNull()
  })

  it('formats an absent account status with safe placeholders', () => {
    expect(formatGrokAccountStatus(null)).toEqual({
      authStatus: 'pending',
      plan: '-',
      billingObservedAt: '-',
      lastRefreshAt: '-',
    })
  })

  it('preserves needs_reauth and the displayed plan', () => {
    expect(
      formatGrokAccountStatus({
        auth_status: 'needs_reauth',
        billing_plan: 'SuperGrok',
        billing_observed_at: 1700000000,
        last_refresh_at: 1700000010,
      })
    ).toEqual({
      authStatus: 'needs_reauth',
      plan: 'SuperGrok',
      billingObservedAt: '2023-11-14 22:13:20',
      lastRefreshAt: '2023-11-14 22:13:30',
    })
  })

  it('preserves active account state and falls back to the raw tier', () => {
    expect(
      formatGrokAccountStatus({
        auth_status: 'active',
        tier_raw: 'premium-plus',
      })
    ).toMatchObject({
      authStatus: 'active',
      plan: 'premium-plus',
    })
  })
})
