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
import { describe, it } from 'node:test'

import {
  DEFAULT_SAVINGS_SETTING,
  formatSavingsSetting,
  parseSavingsSetting,
} from '../savings-estimate-setting.ts'

describe('savings estimate setting serialization', () => {
  it('applies defaults and removes obsolete fields', () => {
    const setting = parseSavingsSetting(`{
      "enabled": true,
      "show_on_dashboard": "yes",
      "official_price_stale_days": 0.5,
      "max_summary_days": 7.9,
      "max_summary_log_rows": 0,
      "official_prices": [],
      "reference_price_source": "legacy",
      "include_unpriced_models": true,
      "custom_field": "preserved"
    }`)

    assert.ok(setting)
    assert.equal(setting.enabled, true)
    assert.equal(
      setting.show_on_dashboard,
      DEFAULT_SAVINGS_SETTING.show_on_dashboard
    )
    assert.equal(
      setting.official_price_stale_days,
      DEFAULT_SAVINGS_SETTING.official_price_stale_days
    )
    assert.equal(setting.max_summary_days, 7)
    assert.equal(
      setting.max_summary_log_rows,
      DEFAULT_SAVINGS_SETTING.max_summary_log_rows
    )
    assert.deepEqual(setting.official_prices, {})
    assert.equal(setting.reference_price_source, undefined)
    assert.equal(setting.include_unpriced_models, undefined)
    assert.equal(setting.custom_field, 'preserved')
  })

  it('rejects invalid JSON and non-object roots', () => {
    assert.equal(parseSavingsSetting('{invalid'), null)
    assert.equal(parseSavingsSetting('[]'), null)
  })

  it('formats normalized settings while preserving invalid source text', () => {
    const formatted = formatSavingsSetting('{"enabled":true}')
    assert.deepEqual(JSON.parse(formatted), parseSavingsSetting(formatted))
    assert.match(formatted, /\n {2}"enabled": true/)
    assert.equal(formatSavingsSetting('{invalid'), '{invalid')
  })
})
