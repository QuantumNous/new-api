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

import { readCookie, SESSION_HINT_COOKIE_NAME } from './session-hint'

describe('session hint cookie parsing', () => {
  test('reads the hint from among unrelated cookies', (): void => {
    const header = `theme=dark; ${SESSION_HINT_COOKIE_NAME}=1; lang=zh-CN`
    expect(readCookie(header, SESSION_HINT_COOKIE_NAME)).toBe('1')
  })

  test('reads the hint when it is the only cookie', (): void => {
    expect(
      readCookie(`${SESSION_HINT_COOKIE_NAME}=1`, SESSION_HINT_COOKIE_NAME)
    ).toBe('1')
  })

  test('reports absence for an empty cookie header', (): void => {
    expect(readCookie('', SESSION_HINT_COOKIE_NAME)).toBeNull()
  })

  // A name that merely contains the hint's name must not be mistaken for it,
  // or an unrelated cookie would keep the doomed refresh alive forever.
  test('does not match a cookie whose name merely contains the hint name', (): void => {
    const header = `not_${SESSION_HINT_COOKIE_NAME}=1; ${SESSION_HINT_COOKIE_NAME}_extra=1`
    expect(readCookie(header, SESSION_HINT_COOKIE_NAME)).toBeNull()
  })

  test('tolerates the whitespace browsers put after separators', (): void => {
    const header = `a=1;${SESSION_HINT_COOKIE_NAME}=1;  b=2`
    expect(readCookie(header, SESSION_HINT_COOKIE_NAME)).toBe('1')
  })

  // The server only ever writes "1", but presence is what the caller acts on;
  // an empty value still means a Set-Cookie arrived and must not read as absent.
  test('distinguishes an empty value from a missing cookie', (): void => {
    expect(
      readCookie(`${SESSION_HINT_COOKIE_NAME}=`, SESSION_HINT_COOKIE_NAME)
    ).toBe('')
    expect(readCookie('other=1', SESSION_HINT_COOKIE_NAME)).toBeNull()
  })

  test('ignores malformed segments without a separator', (): void => {
    expect(readCookie('broken; other=1', SESSION_HINT_COOKIE_NAME)).toBeNull()
  })
})
