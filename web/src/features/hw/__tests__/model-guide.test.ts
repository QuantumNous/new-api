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
  PREMIUM_NOTICE,
  premiumNotice,
  RECOMMENDED_ORDER,
  recommendedRank,
} from '../data/model-guide'
import {
  isPremiumModel,
  MODEL_PRICES,
  PREMIUM_INPUT_USD_PER_M,
  premiumStepDown,
  type ModelPrice,
} from '../data/model-prices'

describe('model guide', () => {
  it('describes every recommended model in Turkish and English', () => {
    expect(RECOMMENDED_ORDER).toHaveLength(9)
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

  it('puts Fable first and Astra second, and unknown models last', () => {
    expect(recommendedRank('claude-fable-5-1')).toBe(0)
    expect(recommendedRank('gpt-6-astra')).toBe(1)
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

describe('premium models', () => {
  it('uses the backend threshold of 10 dollars per 1M input tokens', () => {
    expect(PREMIUM_INPUT_USD_PER_M).toBe(10)
  })

  it('points each premium model to the model one step lower', () => {
    expect(premiumStepDown('claude-fable-5-1')).toBe('claude-opus-5-5')
    expect(premiumStepDown('gpt-6-astra')).toBe('gpt-6.1-sol')
  })

  it('has no step-down for models below the threshold', () => {
    for (const name of [
      'claude-opus-5-5',
      'claude-haiku-5-5',
      'grok-4',
      'unknown',
      undefined,
    ]) {
      expect(premiumStepDown(name), String(name)).toBeUndefined()
      expect(isPremiumModel(name), String(name)).toBe(false)
    }
  })

  it('treats a future model at or above the threshold as premium', () => {
    const fixtures: ModelPrice[] = [
      ...MODEL_PRICES,
      {
        model: 'claude-future-9',
        provider: 'Anthropic',
        official: { input: 15, output: 75 },
        openrouter: null,
        hisarweb: { input: 7.5, output: 37.5 },
      },
      {
        model: 'gemini-lonely',
        provider: 'Google',
        official: { input: 12, output: 60 },
        openrouter: null,
        hisarweb: { input: 6, output: 30 },
      },
    ]
    expect(isPremiumModel('claude-future-9', fixtures)).toBe(true)
    // Strictly cheaper, highest first: Fable (10) beats Opus (4).
    expect(premiumStepDown('claude-future-9', fixtures)).toBe(
      'claude-fable-5-1'
    )
    // Premium, but no cheaper model of the same provider: no notice.
    expect(isPremiumModel('gemini-lonely', fixtures)).toBe(true)
    expect(premiumStepDown('gemini-lonely', fixtures)).toBeUndefined()
    expect(premiumNotice('gemini-lonely', 'en', fixtures)).toBeUndefined()
    expect(MODEL_PRICES).toHaveLength(9)
  })

  it('writes the notice in Turkish and English without an em-dash', () => {
    expect(premiumNotice('claude-fable-5-1', 'tr')).toBe(
      'Bu model kredinizi çok daha hızlı tüketir. Bir alt model, claude-opus-5-5, çok daha ucuz ve neredeyse aynı kalitede.'
    )
    expect(premiumNotice('gpt-6-astra', 'en')).toBe(
      'This model uses up your credit much faster. The model one step lower, gpt-6.1-sol, is much cheaper and almost as good.'
    )
    expect(premiumNotice('claude-sonnet-5-5', 'en')).toBeUndefined()
    expect(PREMIUM_NOTICE.tr + PREMIUM_NOTICE.en).not.toContain('—')
  })
})
