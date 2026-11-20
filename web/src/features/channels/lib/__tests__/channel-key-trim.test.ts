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
  channelFormSchema,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
  type ChannelFormValues,
} from '../channel-form'

function keyForm(
  overrides: Partial<ChannelFormValues> = {}
): ChannelFormValues {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Test channel',
    type: 1,
    key: 'test-key',
    models: 'gpt-5',
    ...overrides,
  }
}

function createKey(key: string): string | null {
  const form = channelFormSchema.parse(keyForm({ key }))
  return transformFormDataToCreatePayload(form).channel.key ?? null
}

function updateKey(key: string): string | undefined {
  const form = channelFormSchema.parse(keyForm({ key }))
  return transformFormDataToUpdatePayload(form, 1).key
}

describe('channel key trimming', () => {
  test('trims surrounding whitespace from a single key on create', () => {
    expect(createKey('  sk-123  ')).toBe('sk-123')
  })

  test('trims each newline-separated key on create and drops blank lines', () => {
    expect(createKey('  key-a \n key-b  \n\n  key-c ')).toBe(
      'key-a\nkey-b\nkey-c'
    )
  })

  test('normalizes CRLF-separated keys on create', () => {
    expect(createKey(' key-a \r\n key-b ')).toBe('key-a\nkey-b')
  })

  test('clears a blank key on create', () => {
    expect(createKey('   ')).toBeNull()
  })

  test('keeps JSON credentials intact apart from surrounding whitespace', () => {
    const jsonKey = '  {\n  "access_token": "abc",\n  "account_id": "123"\n}  '
    expect(createKey(jsonKey)).toBe(
      '{\n  "access_token": "abc",\n  "account_id": "123"\n}'
    )
  })

  test('keeps a JSON array of keys intact apart from surrounding whitespace', () => {
    expect(createKey('  [{"a":1},\n{"b":2}]  ')).toBe('[{"a":1},\n{"b":2}]')
  })

  test('trims each newline-separated key on update', () => {
    expect(updateKey('  key-a \n key-b  ')).toBe('key-a\nkey-b')
  })

  test('omits a blank key on update', () => {
    expect(updateKey('   ')).toBeUndefined()
  })
})
