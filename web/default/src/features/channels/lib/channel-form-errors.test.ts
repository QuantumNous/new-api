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
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { FieldErrors, FieldValues } from 'react-hook-form'
import { CHANNEL_FORM_DEFAULT_VALUES, channelFormSchema } from './channel-form'
import {
  collectErrorFieldNames,
  hasAdvancedSettingsErrors,
  isAdvancedSettingsErrorName,
} from './channel-form-errors'

describe('channel form errors', () => {
  it('detects validation errors in collapsed advanced JSON fields', () => {
    const errors = {
      header_override: { type: 'custom', message: 'Invalid JSON format' },
    } as FieldErrors<FieldValues>

    assert.equal(hasAdvancedSettingsErrors(errors), true)
  })

  it('ignores validation errors outside advanced settings', () => {
    const errors = {
      name: { type: 'too_small', message: 'Channel name is required' },
    } as FieldErrors<FieldValues>

    assert.equal(hasAdvancedSettingsErrors(errors), false)
  })

  it('does not treat model mapping errors as advanced settings errors', () => {
    const errors = {
      model_mapping: { type: 'custom', message: 'Invalid JSON format' },
    } as FieldErrors<FieldValues>

    assert.equal(hasAdvancedSettingsErrors(errors), false)
    assert.equal(isAdvancedSettingsErrorName('model_mapping'), false)
  })

  it('classifies schema errors from invalid advanced JSON fields', () => {
    const result = channelFormSchema.safeParse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'test',
      key: 'sk-test',
      models: 'gpt-4',
      group: ['default'],
      header_override: '{',
    })

    assert.equal(result.success, false)
    if (result.success) return

    const paths = result.error.issues.map((issue) => issue.path.join('.'))
    assert.deepEqual(paths, ['header_override'])
    assert.deepEqual(paths.filter(isAdvancedSettingsErrorName), [
      'header_override',
    ])
  })

  it('collects nested error names', () => {
    const names = collectErrorFieldNames({
      nested: {
        child: { type: 'custom', message: 'Invalid JSON format' },
      },
    } as FieldErrors<FieldValues>)

    assert.deepEqual(names, ['nested.child'])
  })
})
