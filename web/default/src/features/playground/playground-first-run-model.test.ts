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
import { pickFirstRunModel } from './lib/first-run-model'

const models = (...values: string[]) => values.map((value) => ({ value }))

describe('pickFirstRunModel', () => {
  test('uses the configured model when it is available', () => {
    expect(
      pickFirstRunModel(
        models('gemini-2.5-flash', 'gpt-4.1-mini'),
        'gpt-4.1-mini'
      )
    ).toBe('gpt-4.1-mini')
  })

  test('falls back to a cheap flash model when configured model is unavailable', () => {
    expect(
      pickFirstRunModel(
        models('claude-opus-4-5', 'gemini-2.5-flash'),
        'missing-model'
      )
    ).toBe('gemini-2.5-flash')
  })

  test('uses haiku before falling back to the first arbitrary model', () => {
    expect(
      pickFirstRunModel(models('claude-haiku-4-5', 'claude-opus-4-5'))
    ).toBe('claude-haiku-4-5')
  })

  test('ignores invalid model entries from runtime data', () => {
    expect(
      pickFirstRunModel(
        [
          { value: null },
          { value: {} },
          { value: '' },
          { value: 'gemini-2.5-flash' },
        ] as unknown as Array<{ value: string }>,
        'gpt-4.1-mini'
      )
    ).toBe('gemini-2.5-flash')
  })

  test('returns trimmed model names from runtime data', () => {
    expect(
      pickFirstRunModel(
        models('  gemini-2.5-flash  ', 'gpt-4.1-mini'),
        '  gpt-4.1-mini  '
      )
    ).toBe('gpt-4.1-mini')
  })

  test('ignores non-chat models for first-run selection', () => {
    expect(
      pickFirstRunModel(
        models('gpt-image-1', 'sora-2', 'gemini-2.5-flash'),
        'gpt-image-1'
      )
    ).toBe('gemini-2.5-flash')
  })

  test('returns undefined when no chat model is available', () => {
    expect(pickFirstRunModel(models('gpt-image-1', 'sora-2'))).toBeUndefined()
  })
})
