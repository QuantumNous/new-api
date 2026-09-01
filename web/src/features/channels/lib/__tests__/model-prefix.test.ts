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
import { describe, expect, test } from 'vitest'

import type { Channel } from '../../types'
import { getChannelModelPrefix, stripModelPrefix } from '../channel-utils'

describe('stripModelPrefix', () => {
  test('returns the model unchanged when no prefix is set', () => {
    expect(stripModelPrefix('auto-beta', '')).toBe('auto-beta')
  })

  test('strips a matching `<prefix>/` from the model name', () => {
    expect(stripModelPrefix('openrouter/auto-beta', 'openrouter')).toBe(
      'auto-beta'
    )
  })

  test('leaves a model without the prefix untouched', () => {
    expect(stripModelPrefix('auto-beta', 'openrouter')).toBe('auto-beta')
  })

  test('does not strip a partial prefix match without the slash', () => {
    // `openrouterx` is not `openrouter/`, so it must be left intact.
    expect(stripModelPrefix('openrouterx/auto-beta', 'openrouter')).toBe(
      'openrouterx/auto-beta'
    )
  })
})

describe('getChannelModelPrefix', () => {
  function channelWithSettings(settings: string): Channel {
    return { settings } as Channel
  }

  test('returns empty string when settings is empty', () => {
    expect(getChannelModelPrefix(channelWithSettings(''))).toBe('')
    expect(getChannelModelPrefix(channelWithSettings('{}'))).toBe('')
  })

  test('reads model_prefix from the settings JSON', () => {
    expect(
      getChannelModelPrefix(
        channelWithSettings(JSON.stringify({ model_prefix: 'openrouter' }))
      )
    ).toBe('openrouter')
  })

  test('trims surrounding whitespace from the prefix', () => {
    expect(
      getChannelModelPrefix(
        channelWithSettings(JSON.stringify({ model_prefix: '  openrouter  ' }))
      )
    ).toBe('openrouter')
  })

  test('returns empty string when settings JSON is malformed', () => {
    expect(getChannelModelPrefix(channelWithSettings('not-json'))).toBe('')
  })
})
