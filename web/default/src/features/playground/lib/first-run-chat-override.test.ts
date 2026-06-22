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
import { getFirstRunChatOverride } from './first-run-chat-override'

describe('getFirstRunChatOverride', () => {
  test('uses the first-run model only when the visible model is synced', () => {
    expect(
      getFirstRunChatOverride({
        firstRun: true,
        firstRunModel: 'gemini-2.5-flash',
        currentModel: 'gemini-2.5-flash',
        userPickedModel: false,
      })
    ).toEqual({ model: 'gemini-2.5-flash' })
  })

  test('does not hide a visible/request model mismatch', () => {
    expect(
      getFirstRunChatOverride({
        firstRun: true,
        firstRunModel: 'gemini-2.5-flash',
        currentModel: 'gpt-4o-mini',
        userPickedModel: false,
      })
    ).toBeUndefined()
  })

  test('does not fall back when the first-run model list is unavailable', () => {
    expect(
      getFirstRunChatOverride({
        firstRun: true,
        currentModel: 'gpt-4o',
        userPickedModel: false,
      })
    ).toBeUndefined()
  })

  test('does not override after explicit model choice or outside first-run', () => {
    expect(
      getFirstRunChatOverride({
        firstRun: true,
        firstRunModel: 'gemini-2.5-flash',
        currentModel: 'gemini-2.5-flash',
        userPickedModel: true,
      })
    ).toBeUndefined()
    expect(
      getFirstRunChatOverride({
        firstRun: false,
        firstRunModel: 'gemini-2.5-flash',
        currentModel: 'gemini-2.5-flash',
        userPickedModel: false,
      })
    ).toBeUndefined()
  })
})
