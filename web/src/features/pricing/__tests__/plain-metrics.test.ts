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

import { withHwText } from '../../../i18n/hw'
import enUpstream from '../../../i18n/locales/en.json'
import trLocale from '../../../i18n/locales/tr.json'
import { buildSupportedParameters } from '../lib/mock-stats'
import {
  averageResponseTimeMs,
  plainGroupLabel,
  plainParamDescriptionKey,
} from '../lib/plain-metrics'
import type { PricingModel } from '../types'

function model(name: string): PricingModel {
  return {
    id: 1,
    model_name: name,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
  }
}

describe('plain-metrics', () => {
  it('gives every supported parameter a plain sentence in en and tr', () => {
    const names = [
      'gpt-4o',
      'o1',
      'text-embedding-3-small',
      'dall-e-3',
      'sora-2',
    ]
    const en = withHwText('en', enUpstream).translation as Record<string, string>
    const tr = trLocale.translation as Record<string, string>
    for (const name of names) {
      for (const param of buildSupportedParameters(model(name))) {
        const key = plainParamDescriptionKey(param.descriptionKey)
        expect(key, `${name}: ${param.descriptionKey}`).not.toBe(
          param.descriptionKey
        )
        expect(en[key], key).toBe(key)
        expect(tr[key], key).toBeTruthy()
      }
    }
  })

  it('averages only the measured response times', () => {
    expect(
      averageResponseTimeMs([
        { avg_ttft_ms: 400 },
        { avg_ttft_ms: 0 },
        { avg_ttft_ms: 800 },
      ])
    ).toBe(600)
    expect(averageResponseTimeMs([])).toBe(0)
  })

  it('shows every sold group as Everyone and keeps unknown group names', () => {
    const t = ((key: string) => key) as never
    expect(plainGroupLabel('paid', t)).toBe('Everyone')
    expect(plainGroupLabel('default', t)).toBe('Everyone')
    expect(plainGroupLabel('partner', t)).toBe('partner')
  })

  it('shows the free group as a word, not the raw group id', () => {
    const t = ((key: string) => key) as never
    expect(plainGroupLabel('free', t)).toBe('Free')
  })
})
