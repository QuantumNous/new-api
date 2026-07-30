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
// @ts-expect-error Bun's test types are not included in the app tsconfig.
import { describe, expect, test } from 'bun:test'

import {
  modelFormSchema,
  transformFormDataToModelPayload,
  transformModelToFormDefaults,
} from './model-form'

describe('model token limit fields', () => {
  test('defaults missing limits to zero', () => {
    const defaults = transformModelToFormDefaults({
      id: 1,
      model_name: 'example',
      status: 1,
      sync_official: 1,
      created_time: 0,
      updated_time: 0,
      name_rule: 0,
    })
    expect(defaults.context_window).toBe(0)
    expect(defaults.max_output_tokens).toBe(0)
  })

  test('rejects negative and fractional limits', () => {
    const result = modelFormSchema.safeParse({
      model_name: 'example',
      context_window: -1,
      max_output_tokens: 1.5,
    })
    expect(result.success).toBe(false)
  })

  test('submits raw integer token counts', () => {
    const values = modelFormSchema.parse({
      model_name: 'example',
      context_window: 262144,
      max_output_tokens: 32768,
    })
    const payload = transformFormDataToModelPayload(values)
    expect(payload.context_window).toBe(262144)
    expect(payload.max_output_tokens).toBe(32768)
  })
})
