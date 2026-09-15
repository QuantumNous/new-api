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
  OFFICIAL_PRICE_USD_TO_CNY,
  resolveModelProvider,
} from '../model-provider'

describe('model provider reference currency', () => {
  it('keeps existing name-only recognition unchanged', () => {
    expect(resolveModelProvider('gpt-5')?.referenceCurrency).toBe('USD')
    expect(resolveModelProvider('qwen-max')?.referenceCurrency).toBe('CNY')
    expect(resolveModelProvider('codex-auto-review')).toBeNull()
    expect(resolveModelProvider('private-model')).toBeNull()
  })

  it('uses known vendor metadata only when the model name is unknown', () => {
    expect(
      resolveModelProvider('codex-auto-review', 'OpenAI')?.referenceCurrency
    ).toBe('USD')
    expect(
      resolveModelProvider('private-model', 'Moonshot AI')?.referenceCurrency
    ).toBe('CNY')
    expect(resolveModelProvider('qwen-max', 'OpenAI')?.referenceCurrency).toBe(
      'CNY'
    )
    expect(resolveModelProvider('private-model', 'Acme')).toBeNull()
  })

  it('owns the official USD conversion rate', () => {
    expect(OFFICIAL_PRICE_USD_TO_CNY).toBe(6.75)
  })
})
