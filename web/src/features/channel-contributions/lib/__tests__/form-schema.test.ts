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
import { describe, test } from 'node:test'

import type { TFunction } from 'i18next'

import {
  createContributionFormSchema,
  filterContributionModelMappingToModels,
  type ContributionFormValues,
} from '../../form-schema'

const t = ((key: string) => key) as TFunction
const schema = createContributionFormSchema(t)

function validValues(
  overrides: Partial<ContributionFormValues> = {}
): ContributionFormValues {
  return {
    name: 'Shared upstream',
    type: 1,
    base_url: 'https://api.example.com/v1',
    key: 'sk-test',
    group: 'default',
    models: ['gpt-test'],
    model_mapping: '',
    ...overrides,
  }
}

describe('channel contribution form validation', () => {
  test('accepts plain HTTP and HTTPS endpoints', () => {
    assert.equal(schema.safeParse(validValues()).success, true)
    assert.equal(
      schema.safeParse(validValues({ base_url: 'http://localhost.example/v1' }))
        .success,
      true
    )
  })

  test('rejects endpoint credentials, query, fragment, and non-HTTP schemes', () => {
    for (const base_url of [
      'https://user:pass@api.example.com/v1',
      'https://api.example.com/v1?tenant=one',
      'https://api.example.com/v1#models',
      'ftp://api.example.com/v1',
    ]) {
      assert.equal(schema.safeParse(validValues({ base_url })).success, false)
    }
  })

  test('rejects API keys containing line breaks', () => {
    assert.equal(
      schema.safeParse(validValues({ key: 'sk-first\nsk-second' })).success,
      false
    )
  })

  test('removes mappings whose source is absent from a fetched model list', () => {
    assert.equal(
      filterContributionModelMappingToModels(
        JSON.stringify({
          'gpt-current': 'upstream-current',
          'gpt-removed': 'upstream-removed',
        }),
        ['gpt-current', 'gpt-new']
      ),
      JSON.stringify({ 'gpt-current': 'upstream-current' }, null, 2)
    )
  })
})
