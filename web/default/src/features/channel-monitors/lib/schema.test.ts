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

import { channelMonitorFormSchema } from './schema'

const validMonitor = {
  name: 'Status monitor',
  api_url: 'https://example.com/v1',
  api_key: 'sk-test',
  test_model: 'gpt-test',
  interval_seconds: 60,
  timeout_seconds: 15,
  enabled: true,
  visible: true,
  availability_boost_percent: 0,
}

describe('channel monitor availability boost', () => {
  test('accepts bounded percentage values', () => {
    assert.equal(channelMonitorFormSchema.safeParse(validMonitor).success, true)
    assert.equal(
      channelMonitorFormSchema.safeParse({
        ...validMonitor,
        availability_boost_percent: '99.95',
      }).success,
      true
    )
  })

  test('rejects invalid percentages', () => {
    for (const value of ['invalid', '-0.01', '100.01']) {
      assert.equal(
        channelMonitorFormSchema.safeParse({
          ...validMonitor,
          availability_boost_percent: value,
        }).success,
        false
      )
    }
  })
})
