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
import { describe, expect, it } from 'vitest'

import {
  buildConnectDeepLink,
  buildConnectReturnPath,
  buildSignInUrlForConnect,
  normalizeConnectIssueReasonCode,
  pageHttpsOrigin,
  shouldAutoConnect,
} from './connect'

describe('desktop connect helpers', () => {
  it('requires https origin', () => {
    expect(
      pageHttpsOrigin({ protocol: 'https:', origin: 'https://station.example' })
    ).toBe('https://station.example')
    expect(
      pageHttpsOrigin({ protocol: 'http:', origin: 'http://station.example' })
    ).toBe(null)
  })

  it('builds yeschoy deep link', () => {
    expect(buildConnectDeepLink('https://station.example', 'abc')).toBe(
      'yeschoy://connect?origin=https%3A%2F%2Fstation.example&code=abc'
    )
  })

  it('maps auth failures to session_required', () => {
    expect(normalizeConnectIssueReasonCode('AUTH_UNAUTHORIZED', 401)).toBe(
      'session_required'
    )
    expect(normalizeConnectIssueReasonCode('', 401)).toBe('session_required')
    expect(normalizeConnectIssueReasonCode('issue_failed', 503)).toBe(
      'issue_failed'
    )
  })

  it('returns to connect with auto=1 after sign-in', () => {
    expect(buildConnectReturnPath('')).toBe('/desktop/connect?auto=1')
    expect(buildConnectReturnPath('?foo=1')).toBe(
      '/desktop/connect?foo=1&auto=1'
    )
    expect(buildSignInUrlForConnect('')).toBe(
      '/sign-in?redirect=%2Fdesktop%2Fconnect%3Fauto%3D1'
    )
  })

  it('detects auto=1', () => {
    expect(shouldAutoConnect({ auto: '1' })).toBe(true)
    expect(shouldAutoConnect({ auto: true })).toBe(true)
    expect(shouldAutoConnect({ auto: '0' })).toBe(false)
    expect(shouldAutoConnect({})).toBe(false)
  })
})
