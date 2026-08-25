/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import type { DifferencesMap } from '../../types'
import { findModelPriceMatches } from '../model-price-matching'

const differences: DifferencesMap = {
  'glm-5.3': {
    model_ratio: {
      current: null,
      upstreams: { direct: 0.7 },
      confidence: { direct: true },
    },
  },
  'z-ai/glm-5.3': {
    model_ratio: {
      current: null,
      upstreams: { openrouter: 0.7 },
      confidence: { openrouter: true },
    },
    completion_ratio: {
      current: null,
      upstreams: { openrouter: 3.142857 },
      confidence: { openrouter: true },
    },
  },
  'z-ai/glm-5.2': {
    model_ratio: {
      current: null,
      upstreams: { openrouter: 0.483 },
      confidence: { openrouter: true },
    },
  },
  'anthropic/claude-sonnet-4': {
    model_ratio: {
      current: null,
      upstreams: { openrouter: 1.5 },
      confidence: { openrouter: true },
    },
  },
}

describe('model price matching', () => {
  test('ranks exact, normalized, and fuzzy matches in safety order', () => {
    const matches = findModelPriceMatches('glm-5.3', differences)

    expect(matches.map((match) => [match.sourceModel, match.kind])).toEqual([
      ['glm-5.3', 'exact'],
      ['z-ai/glm-5.3', 'normalized'],
      ['z-ai/glm-5.2', 'fuzzy'],
    ])
  })

  test('preserves the selected upstream pricing fields', () => {
    const matches = findModelPriceMatches('glm-5.3', differences)
    const normalizedMatch = matches.find(
      (match) => match.sourceModel === 'z-ai/glm-5.3'
    )

    expect(normalizedMatch).toMatchObject({
      ratio: 0.7,
      completionRatio: 3.142857,
      score: 1,
    })
  })

  test('excludes unrelated model families', () => {
    const matches = findModelPriceMatches('glm-5.3', differences)

    expect(matches.some((match) => match.sourceModel.includes('claude'))).toBe(
      false
    )
  })
})
