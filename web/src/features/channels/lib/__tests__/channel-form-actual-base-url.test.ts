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
  CHANNEL_FORM_DEFAULT_VALUES,
  transformFormDataToUpdatePayload,
} from '../channel-form'

function updateForm(actualBaseUrl: string) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Test channel',
    key: 'test-key',
    models: 'gpt-4',
    actual_base_url: actualBaseUrl,
  }
}

describe('actual_base_url update payload', () => {
  test('sends empty string so the backend can clear the stored value', () => {
    const payload = transformFormDataToUpdatePayload(updateForm(''), 1)

    expect(payload.actual_base_url).toBe('')
  })

  test('sends a normalized URL when the field is set', () => {
    const payload = transformFormDataToUpdatePayload(
      updateForm('https://upstream.example.com/'),
      1
    )

    expect(payload.actual_base_url).toBe('https://upstream.example.com')
  })
})
