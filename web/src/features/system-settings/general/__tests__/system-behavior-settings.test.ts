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
  getSystemBehaviorOptionUpdates,
  toSystemBehaviorFormValues,
} from '../system-behavior-settings'

describe('system behavior settings', () => {
  test('round-trips the nested OpenAI Batch toggle to a flat option update', () => {
    const options = {
      DefaultCollapseSidebar: false,
      DemoSiteEnabled: false,
      SelfUseModeEnabled: false,
      'openai_batch_setting.enabled': false,
    }

    const formValues = toSystemBehaviorFormValues(options)
    assert.deepEqual(formValues.openai_batch_setting, { enabled: false })

    const updates = getSystemBehaviorOptionUpdates(
      {
        ...formValues,
        openai_batch_setting: { enabled: true },
      },
      options
    )
    assert.deepEqual(updates, [
      { key: 'openai_batch_setting.enabled', value: true },
    ])
  })
})
