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
  clearAutoCreateSearch,
  clearCreateDialogSearch,
  validateApiKeySearch,
} from './index'

describe('validateApiKeySearch', () => {
  test('preserves auto-create marker as create=1', () => {
    expect(validateApiKeySearch({ create: '1' })).toEqual({ create: 1 })
    expect(validateApiKeySearch({ create: true })).toEqual({ create: 1 })
    expect(validateApiKeySearch({ create: 'true' })).toEqual({ create: 1 })
  })

  test('omits create when the value is not an auto-create marker', () => {
    expect(validateApiKeySearch({})).toEqual({})
    expect(validateApiKeySearch({ create: '0' })).toEqual({})
    expect(validateApiKeySearch({ create: false })).toEqual({})
  })

  test('preserves the non-destructive create dialog deep link', () => {
    expect(validateApiKeySearch({ open: 'create', group: 'standard' })).toEqual(
      { open: 'create', group: 'standard' }
    )
    expect(validateApiKeySearch({ open: 'create' })).toEqual({
      open: 'create',
    })
    expect(
      validateApiKeySearch({ open: 'invalid', group: 'standard' })
    ).toEqual({})
  })

  test('keeps create=1 and open=create independent when both are present', () => {
    expect(
      validateApiKeySearch({
        create: '1',
        open: 'create',
        group: 'standard',
      })
    ).toEqual({ create: 1, open: 'create', group: 'standard' })
  })

  test('keeps the list group filter independent from create-dialog group', () => {
    expect(
      validateApiKeySearch({
        keyGroup: ['vip'],
        group: 'create-only-group',
      })
    ).toEqual({ keyGroup: ['vip'] })
    expect(
      validateApiKeySearch({
        open: 'create',
        group: 'standard',
        keyGroup: ['vip'],
      })
    ).toEqual({ open: 'create', group: 'standard', keyGroup: ['vip'] })
  })
})

describe('API key search cleanup', () => {
  const search = {
    page: 2,
    filter: 'team',
    create: 1,
    open: 'create',
    group: 'standard',
  }

  test('dialog cleanup removes only open and group', () => {
    expect(clearCreateDialogSearch(search)).toEqual({
      page: 2,
      filter: 'team',
      create: 1,
      open: undefined,
      group: undefined,
    })
  })

  test('auto-create cleanup removes only create', () => {
    expect(clearAutoCreateSearch(search)).toEqual({
      page: 2,
      filter: 'team',
      create: undefined,
      open: 'create',
      group: 'standard',
    })
  })
})
