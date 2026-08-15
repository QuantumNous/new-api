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
import { describe, test } from 'node:test'

import { autoPricingFormSchema } from '../auto-pricing-form'

const validValues = {
  enabled: true,
  remoteUrl:
    'https://raw.githubusercontent.com/Wei-Shaw/model-price-repo/main/model_prices_and_context_window.json',
  hashUrl: '',
  modelsDevUrl: 'https://models.dev/api.json',
  checkIntervalMinutes: 60,
  fuzzyMatchEnabled: true,
}

describe('auto pricing settings validation', () => {
  test('accepts the shipped defaults', () => {
    assert.equal(autoPricingFormSchema.safeParse(validValues).success, true)
  })

  test('accepts an optional checksum URL when it is a valid URL or empty', () => {
    for (const hashUrl of ['', 'https://mirror.example.com/catalog.sha256']) {
      const result = autoPricingFormSchema.safeParse({
        ...validValues,
        hashUrl,
      })
      assert.equal(result.success, true, `hashUrl ${JSON.stringify(hashUrl)}`)
    }
  })

  test('rejects catalog URLs that are not http(s) URLs', () => {
    for (const remoteUrl of [
      '',
      'not a url',
      'ftp://mirror.example.com/catalog.json',
      'file:///etc/passwd',
    ]) {
      const result = autoPricingFormSchema.safeParse({
        ...validValues,
        remoteUrl,
      })
      assert.equal(
        result.success,
        false,
        `remoteUrl ${JSON.stringify(remoteUrl)} must be rejected`
      )
    }
  })

  test('rejects intervals the backend would clamp away', () => {
    // The server treats anything below 5 minutes as misconfigured
    // (setting/ratio_setting/auto_price_setting.go), so the form must not
    // accept a value that would silently behave as 60.
    for (const checkIntervalMinutes of [0, 4, -10, 2.5, 20000]) {
      const result = autoPricingFormSchema.safeParse({
        ...validValues,
        checkIntervalMinutes,
      })
      assert.equal(
        result.success,
        false,
        `interval ${checkIntervalMinutes} must be rejected`
      )
    }
  })

  test('coerces numeric strings from the form input into integers', () => {
    const result = autoPricingFormSchema.safeParse({
      ...validValues,
      checkIntervalMinutes: '120',
    })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.checkIntervalMinutes, 120)
    }
  })
})
