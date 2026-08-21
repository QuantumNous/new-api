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

import { CHANNEL_FORM_DEFAULT_VALUES, channelFormSchema } from '../channel-form'

const CHANNEL_TYPE_CODEX = 57

function codexForm(key: string) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Codex',
    type: CHANNEL_TYPE_CODEX,
    key,
    models: 'gpt-5-codex',
  }
}

function keyIssue(result: ReturnType<typeof channelFormSchema.safeParse>) {
  if (result.success) return undefined
  return result.error.issues.find((issue) => issue.path[0] === 'key')
}

describe('Codex channel credential', () => {
  test('accepts a flat OAuth credential', () => {
    const result = channelFormSchema.safeParse(
      codexForm(
        '{"access_token":"at","refresh_token":"rt","account_id":"acc"}'
      )
    )

    expect(result.success).toBe(true)
  })

  test('accepts the nested tokens layout from ~/.codex/auth.json', () => {
    const authJson = JSON.stringify({
      OPENAI_API_KEY: null,
      tokens: {
        id_token: 'id',
        access_token: 'at',
        refresh_token: 'rt',
        account_id: 'acc',
      },
      last_refresh: '2026-08-01T00:00:00Z',
    })

    expect(channelFormSchema.safeParse(codexForm(authJson)).success).toBe(true)
  })

  test('rejects a credential missing access_token or account_id everywhere', () => {
    const missing = channelFormSchema.safeParse(
      codexForm('{"refresh_token":"rt"}')
    )
    expect(missing.success).toBe(false)
    expect(keyIssue(missing)?.message).toBe(
      'Codex credential must be a JSON object with access_token and account_id'
    )

    const nestedMissing = channelFormSchema.safeParse(
      codexForm('{"tokens":{"refresh_token":"rt"}}')
    )
    expect(nestedMissing.success).toBe(false)
    expect(keyIssue(nestedMissing)?.message).toBe(
      'Codex credential must be a JSON object with access_token and account_id'
    )
  })

  test('rejects a non-JSON key', () => {
    const result = channelFormSchema.safeParse(codexForm('sk-not-json'))

    expect(result.success).toBe(false)
    expect(keyIssue(result)).toBeDefined()
  })
})
