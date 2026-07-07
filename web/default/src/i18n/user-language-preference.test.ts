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
import { afterEach, describe, expect, test } from 'bun:test'
import { api } from '@/lib/api'
import {
  getPreferredUserLanguage,
  syncUserLanguagePreferenceToDatabase,
} from './user-language-preference'

const originalPut = api.put

afterEach(() => {
  api.put = originalPut
})

describe('user language preference sync', () => {
  test('updates the user database preference from the cookie language', async () => {
    const calls: Array<{ url: string; payload: unknown }> = []
    api.put = ((url: string, payload: unknown) => {
      calls.push({ url, payload })
      return Promise.resolve({ data: { success: true } })
    }) as typeof api.put

    let updatedUser:
      | {
          id: number
          setting: string
          language?: string
        }
      | undefined

    await syncUserLanguagePreferenceToDatabase(
      { id: 1, setting: JSON.stringify({ language: 'en' }) },
      'ja',
      (user) => {
        updatedUser = user
      }
    )

    expect(calls).toEqual([
      { url: '/api/user/self', payload: { language: 'ja' } },
    ])
    expect(getPreferredUserLanguage(updatedUser)).toBe('ja')
  })

  test('does not write when the database already matches the cookie language', async () => {
    const calls: Array<{ url: string; payload: unknown }> = []
    api.put = ((url: string, payload: unknown) => {
      calls.push({ url, payload })
      return Promise.resolve({ data: { success: true } })
    }) as typeof api.put

    await syncUserLanguagePreferenceToDatabase(
      { id: 1, setting: JSON.stringify({ language: 'ja' }) },
      'ja'
    )

    expect(calls).toEqual([])
  })

  test('does not coerce unsupported cookie languages into the database', async () => {
    const calls: Array<{ url: string; payload: unknown }> = []
    api.put = ((url: string, payload: unknown) => {
      calls.push({ url, payload })
      return Promise.resolve({ data: { success: true } })
    }) as typeof api.put

    await syncUserLanguagePreferenceToDatabase(
      { id: 1, setting: JSON.stringify({ language: 'ja' }) },
      'de'
    )

    expect(calls).toEqual([])
  })
})
