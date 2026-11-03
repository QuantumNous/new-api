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
import { describe, expect, it } from 'vitest'

import {
  guideText,
  MODEL_GUIDE,
  modelGuide,
  RECOMMENDED_ORDER,
  recommendedRank,
} from '../data/model-guide'
import { MODEL_PRICES } from '../data/model-prices'

describe('model guide', () => {
  it('describes every recommended model in Turkish and English', () => {
    expect(RECOMMENDED_ORDER).toHaveLength(8)
    for (const name of RECOMMENDED_ORDER) {
      const guide = modelGuide(name)
      expect(guide, name).toBeDefined()
      expect(guide?.tag.tr.length).toBeGreaterThan(0)
      expect(guide?.tag.en.length).toBeGreaterThan(0)
      expect(guide?.description.tr.length).toBeGreaterThan(40)
      expect(guide?.description.en.length).toBeGreaterThan(40)
    }
    expect(Object.keys(MODEL_GUIDE).sort()).toEqual(
      [...RECOMMENDED_ORDER].sort()
    )
  })

  it('has a guide entry for every model in the price table', () => {
    for (const price of MODEL_PRICES) {
      expect(modelGuide(price.model), price.model).toBeDefined()
    }
  })

  it('never names a vendor reseller in a customer text', () => {
    const all = JSON.stringify(MODEL_GUIDE).toLowerCase()
    expect(all).not.toContain('open' + 'router')
    expect(all).not.toContain('lu' + 'mia')
  })

  it('puts Astra first and Opus second, and unknown models last', () => {
    expect(recommendedRank('gpt-6-astra')).toBe(0)
    expect(recommendedRank('claude-opus-5-5')).toBe(1)
    expect(recommendedRank('something-else')).toBe(RECOMMENDED_ORDER.length)
    expect(recommendedRank(undefined)).toBe(RECOMMENDED_ORDER.length)
  })

  it('picks the language of a text', () => {
    const text = { tr: 'merhaba', en: 'hello' }
    expect(guideText(text, 'tr')).toBe('merhaba')
    expect(guideText(text, 'tr-TR')).toBe('merhaba')
    expect(guideText(text, 'en')).toBe('hello')
    expect(guideText(text, 'nl')).toBe('hello')
  })

  it('lists the price table in the recommended order', () => {
    expect(MODEL_PRICES.map((price) => price.model)).toEqual([
      ...RECOMMENDED_ORDER,
    ])
  })
})
