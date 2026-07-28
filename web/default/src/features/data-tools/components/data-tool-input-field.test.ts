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
  getInitialDataToolFieldValue,
  parseDataToolFieldValue,
} from './data-tool-input-field'

describe('data tool dynamic input parsing', () => {
  test('preserves object defaults as editable JSON', () => {
    expect(
      getInitialDataToolFieldValue({
        type: 'object',
        default: { country: 'US', limit: 10 },
      })
    ).toBe('{\n  "country": "US",\n  "limit": 10\n}')
  })

  test('parses number, integer, boolean, array and object fields', () => {
    expect(
      parseDataToolFieldValue('limit', { type: 'number' }, '10', true)
    ).toBe(10)
    expect(
      parseDataToolFieldValue('page', { type: 'integer' }, '2', true)
    ).toBe(2)
    expect(
      parseDataToolFieldValue('enabled', { type: 'boolean' }, 'false', true)
    ).toBe(false)
    expect(
      parseDataToolFieldValue('items', { type: 'array' }, '["a","b"]', true)
    ).toEqual(['a', 'b'])
    expect(
      parseDataToolFieldValue('payload', { type: 'object' }, '{"a":1}', true)
    ).toEqual({ a: 1 })
  })

  test('rejects a missing required field and invalid JSON shape', () => {
    expect(() =>
      parseDataToolFieldValue('query', { type: 'string' }, '', true)
    ).toThrow('query is required')
    expect(() =>
      parseDataToolFieldValue('items', { type: 'array' }, '{"a":1}', true)
    ).toThrow('items must be a JSON array')
    expect(() =>
      parseDataToolFieldValue('page', { type: 'integer' }, '1.5', true)
    ).toThrow('page must be an integer')
  })
})
