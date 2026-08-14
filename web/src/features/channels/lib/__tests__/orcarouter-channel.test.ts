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
  CHANNEL_TYPE_OPTIONS,
  CHANNEL_TYPE_ORCA_ROUTER,
  MODEL_FETCHABLE_TYPES,
} from '../../constants'
import { CHANNEL_FORM_DEFAULT_VALUES, channelFormSchema } from '../channel-form'
import { getChannelTypeConfig } from '../channel-type-config'
import { getChannelTypeIcon, getKeyPromptForType } from '../channel-utils'

function orcaRouterForm(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'OrcaRouter upstream',
    type: CHANNEL_TYPE_ORCA_ROUTER,
    key: 'sk-orca-test-key',
    models: 'deepseek/deepseek-v4-flash',
    ...overrides,
  }
}

describe('OrcaRouter channel', () => {
  test('registers selection, ordering, model discovery, and icon metadata', () => {
    const option = CHANNEL_TYPE_OPTIONS.find(
      (item) => item.value === CHANNEL_TYPE_ORCA_ROUTER
    )

    assert.deepEqual(option, {
      value: CHANNEL_TYPE_ORCA_ROUTER,
      label: 'OrcaRouter',
    })
    assert.equal(
      CHANNEL_TYPE_OPTIONS.findIndex(
        (item) => item.value === CHANNEL_TYPE_ORCA_ROUTER
      ),
      CHANNEL_TYPE_OPTIONS.findIndex((item) => item.value === 20) + 1
    )
    assert.equal(MODEL_FETCHABLE_TYPES.has(CHANNEL_TYPE_ORCA_ROUTER), true)
    assert.equal(getChannelTypeIcon(CHANNEL_TYPE_ORCA_ROUTER), 'OpenAI')
    assert.equal(
      getKeyPromptForType(CHANNEL_TYPE_ORCA_ROUTER),
      'Enter API key for this channel'
    )
    const config = getChannelTypeConfig(CHANNEL_TYPE_ORCA_ROUTER)
    assert.equal(config.icon, 'OpenAI')
    assert.equal(config.defaultBaseUrl, 'https://api.orcarouter.ai')
  })

  test('accepts an empty Base URL (default upstream base URL applies)', () => {
    assert.equal(channelFormSchema.safeParse(orcaRouterForm({ base_url: '' }))
      .success, true)
  })

  test('accepts a custom Base URL', () => {
    assert.equal(
      channelFormSchema.safeParse(
        orcaRouterForm({ base_url: 'https://api.orcarouter.ai' })
      ).success,
      true
    )
  })
})
