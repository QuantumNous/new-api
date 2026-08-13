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

import {
  CHANNEL_FORM_DEFAULT_VALUES,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from '../channel-form'

describe('channel upstream cost rate', () => {
  test('persists a positive CNY rate in channel settings', () => {
    const payload = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'Yunwu',
      key: 'test-key',
      models: 'gpt-5.6-sol',
      upstream_cost_rate_cny: 0.495,
    })

    const settings = JSON.parse(String(payload.channel.settings)) as Record<
      string,
      unknown
    >
    assert.equal(settings.upstream_cost_mode, 'billing_units')
    assert.equal(settings.upstream_cost_unit, 'UNIT')
    assert.equal(settings.upstream_cost_rate_cny, 0.495)
    assert.equal(settings.upstream_cost_price_version, 'manual')
  })

  test('removes the stored rate when cost tracking is cleared', () => {
    const payload = transformFormDataToUpdatePayload(
      {
        ...CHANNEL_FORM_DEFAULT_VALUES,
        name: 'Yunwu',
        models: 'gpt-5.6-sol',
        settings: JSON.stringify({
          upstream_cost_mode: 'auto',
          upstream_cost_unit: 'CREDIT',
          upstream_cost_rate_cny: 0.495,
          upstream_cost_price_version: 'yunwu-2026-07',
        }),
        upstream_cost_rate_cny: undefined,
      },
      36
    )

    const settings = JSON.parse(String(payload.settings)) as Record<
      string,
      unknown
    >
    assert.equal('upstream_cost_mode' in settings, false)
    assert.equal('upstream_cost_unit' in settings, false)
    assert.equal('upstream_cost_rate_cny' in settings, false)
    assert.equal('upstream_cost_price_version' in settings, false)
  })
})
