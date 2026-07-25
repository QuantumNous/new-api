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
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSearchParams } from '../lib/filter'
import { buildApiParams } from '../lib/utils'

describe('usage-log model filter parameters', () => {
  it('uses contains matching by default and preserves exact mode in the URL', () => {
    const containsSearch = buildSearchParams({ model: '  gpt  ' }, 'common')
    assert.equal(containsSearch.model, 'gpt')
    assert.equal(containsSearch.modelNameMode, 'contains')

    const exactSearch = buildSearchParams(
      { model: 'gpt-4', modelNameMode: 'exact' },
      'common'
    )
    assert.equal(exactSearch.modelNameMode, 'exact')
  })

  it('passes the selected mode to list and statistics API parameters', () => {
    const containsParams = buildApiParams({
      page: 1,
      pageSize: 20,
      searchParams: { model: '  gpt  ' },
      isAdmin: true,
    })
    assert.equal(containsParams.model_name, 'gpt')
    assert.equal(containsParams.model_name_mode, 'contains')

    const exactParams = buildApiParams({
      page: 1,
      pageSize: 20,
      searchParams: { model: 'gpt-4', modelNameMode: 'exact' },
      isAdmin: true,
    })
    assert.equal(exactParams.model_name, 'gpt-4')
    assert.equal(exactParams.model_name_mode, 'exact')
  })

  it('applies the mode to column filters and falls back from invalid URL values', () => {
    const exactParams = buildApiParams({
      page: 1,
      pageSize: 20,
      searchParams: { modelNameMode: 'exact' },
      columnFilters: [{ id: 'model_name', value: 'gpt-4' }],
      isAdmin: true,
    })
    assert.equal(exactParams.model_name_mode, 'exact')

    const fallbackParams = buildApiParams({
      page: 1,
      pageSize: 20,
      searchParams: { model: 'gpt', modelNameMode: 'unsupported' },
      isAdmin: false,
    })
    assert.equal(fallbackParams.model_name_mode, 'contains')
  })
})
