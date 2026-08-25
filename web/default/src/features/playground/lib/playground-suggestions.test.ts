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
import { describe, expect, test } from 'bun:test'
import {
  resolveQuickStartModel,
  shouldShowQuickStartSuggestions,
} from './playground-suggestions'

const models = [
  { label: 'grok-imagine-image', value: 'grok-imagine-image' },
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'seedance-2.5', value: 'seedance-2.5' },
  { label: 'seedance-2.0-fast', value: 'seedance-2.0-fast' },
  { label: 'seedance-2.0', value: 'seedance-2.0' },
]

describe('resolveQuickStartModel', () => {
  test('prefers the configured image and video defaults', () => {
    expect(resolveQuickStartModel(models, 'image')).toBe('gpt-image-2')
    expect(resolveQuickStartModel(models, 'video')).toBe('seedance-2.5')
  })

  test('falls back to the first visible model of the requested media kind', () => {
    expect(resolveQuickStartModel(models.slice(0, 1), 'image')).toBe(
      'grok-imagine-image'
    )
    expect(resolveQuickStartModel(models.slice(2, 3), 'video')).toBe(
      'seedance-2.5'
    )
  })

  test('returns undefined when no visible model supports the media kind', () => {
    expect(
      resolveQuickStartModel([{ label: 'gpt-4o', value: 'gpt-4o' }], 'image')
    ).toBeUndefined()
  })
})

describe('shouldShowQuickStartSuggestions', () => {
  test('shows suggestions only for a blank prompt', () => {
    expect(shouldShowQuickStartSuggestions('')).toBe(true)
    expect(shouldShowQuickStartSuggestions('   ')).toBe(true)
    expect(shouldShowQuickStartSuggestions('draw a cat')).toBe(false)
  })
})
