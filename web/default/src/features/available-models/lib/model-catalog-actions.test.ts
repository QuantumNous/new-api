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
  getModelQuickstartLink,
  getModelQuickstartSearch,
} from './model-catalog-actions'

describe('getModelQuickstartSearch', () => {
  test('carries the model id to the overview integration flow', () => {
    expect(getModelQuickstartSearch('gpt-4o-mini')).toEqual({
      model: 'gpt-4o-mini',
    })
  })

  test('trims surrounding whitespace', () => {
    expect(getModelQuickstartSearch('  gpt-4o-mini  ')).toEqual({
      model: 'gpt-4o-mini',
    })
  })

  test('omits the param for a blank model id', () => {
    expect(getModelQuickstartSearch('   ')).toEqual({})
  })
})

describe('getModelQuickstartLink', () => {
  test('targets the dashboard overview carrying the model id', () => {
    expect(getModelQuickstartLink('gpt-4o-mini')).toEqual({
      to: '/dashboard/$section',
      params: { section: 'overview' },
      search: { model: 'gpt-4o-mini' },
    })
  })

  test('still targets the overview for a blank model id', () => {
    expect(getModelQuickstartLink('   ')).toEqual({
      to: '/dashboard/$section',
      params: { section: 'overview' },
      search: {},
    })
  })
})
