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
  QUICK_START_MODELS,
  isQuickStartModelAvailable,
  shouldShowQuickStartSuggestions,
} from './playground-suggestions'

const models = [
  { label: 'grok-imagine-image', value: 'grok-imagine-image' },
  { label: 'gpt-image-2', value: 'gpt-image-2' },
  { label: 'seedance-2.5', value: 'seedance-2.5' },
  { label: 'seedance-2.0-fast', value: 'seedance-2.0-fast' },
  { label: 'seedance-2.0', value: 'seedance-2.0' },
]

describe('quick-start model mapping', () => {
  test('keeps each media prompt bound to its exact target model', () => {
    expect(QUICK_START_MODELS).toEqual({
      image: 'gpt-image-2',
      video: 'seedance-2.5',
    })
  })

  test('only reports a quick-start model as available on an exact match', () => {
    expect(isQuickStartModelAvailable(models, QUICK_START_MODELS.image)).toBe(
      true
    )
    expect(
      isQuickStartModelAvailable(
        [{ label: 'Seedance 2.0', value: 'seedance-2.0' }],
        QUICK_START_MODELS.video
      )
    ).toBe(false)
  })

  test('does not treat another model in the same media family as a match', () => {
    expect(
      isQuickStartModelAvailable(
        [{ label: 'Grok Imagine', value: 'grok-imagine-image' }],
        QUICK_START_MODELS.image
      )
    ).toBe(false)
  })
})

describe('shouldShowQuickStartSuggestions', () => {
  test('shows suggestions only for a blank prompt', () => {
    expect(shouldShowQuickStartSuggestions('')).toBe(true)
    expect(shouldShowQuickStartSuggestions('   ')).toBe(true)
    expect(shouldShowQuickStartSuggestions('draw a cat')).toBe(false)
  })
})
