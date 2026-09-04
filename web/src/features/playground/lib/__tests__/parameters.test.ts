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

import {
  PLAYGROUND_PARAMETER_CONTROLS,
  normalizeParameterNumberValue,
} from '../parameters/playground-parameters'

describe('PLAYGROUND_PARAMETER_CONTROLS ranges', () => {
  test('uses 0.01 steps and 0 floors for float parameters', () => {
    const controls = new Map(
      PLAYGROUND_PARAMETER_CONTROLS.map((item) => [item.key, item])
    )

    for (const key of ['temperature', 'top_p'] as const) {
      expect(controls.get(key)?.min).toBe(0)
      expect(controls.get(key)?.step).toBe(0.01)
    }

    for (const key of ['frequency_penalty', 'presence_penalty'] as const) {
      expect(controls.get(key)?.min).toBe(-2)
      expect(controls.get(key)?.step).toBe(0.01)
    }
  })
})

describe('normalizeParameterNumberValue', () => {
  test('keeps explicit 0 for float parameters', () => {
    expect(normalizeParameterNumberValue('temperature', 0)).toBe(0)
    expect(normalizeParameterNumberValue('temperature', '0')).toBe(0)
    expect(normalizeParameterNumberValue('top_p', 0)).toBe(0)
  })

  test('rounds to the control step precision', () => {
    expect(normalizeParameterNumberValue('temperature', 0.005)).toBe(0.01)
    expect(normalizeParameterNumberValue('temperature', '0.555')).toBe(0.56)
    expect(normalizeParameterNumberValue('frequency_penalty', -1.234)).toBe(
      -1.23
    )
  })

  test('rejects malformed input with a fallback', () => {
    expect(normalizeParameterNumberValue('temperature', '0.5abc')).toBe(0)
    expect(normalizeParameterNumberValue('temperature', '  ')).toBe(0)
    expect(normalizeParameterNumberValue('temperature', Number.NaN)).toBe(0)
  })

  test('clamps out-of-range values', () => {
    expect(normalizeParameterNumberValue('top_p', 5)).toBe(1)
    expect(normalizeParameterNumberValue('top_p', -1)).toBe(0)
    expect(normalizeParameterNumberValue('frequency_penalty', -9)).toBe(-2)
  })

  test('truncates integer-step parameters and maps empty seed to null', () => {
    expect(normalizeParameterNumberValue('max_tokens', 4096.7)).toBe(4096)
    expect(normalizeParameterNumberValue('seed', 99.9)).toBe(99)
    expect(normalizeParameterNumberValue('seed', '')).toBeNull()
  })
})
