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

import { isOperatorRoute } from '../operator-route'

describe('isOperatorRoute', () => {
  it('keeps the access terminal off the gateway backstage', () => {
    expect(isOperatorRoute('/keys')).toBe(false)
    expect(isOperatorRoute('/wallet')).toBe(false)
    expect(isOperatorRoute('/usage-logs/common')).toBe(false)
    expect(isOperatorRoute('/dashboard/overview')).toBe(false)
    expect(isOperatorRoute('/dashboard/reports')).toBe(false)
    expect(isOperatorRoute('/pricing')).toBe(false)
    expect(isOperatorRoute('/playground')).toBe(false)
    expect(isOperatorRoute('/beginner-guide')).toBe(false)
  })

  it('recognizes operator workspaces', () => {
    expect(isOperatorRoute('/channels')).toBe(true)
    expect(isOperatorRoute('/system-settings/site')).toBe(true)
    expect(isOperatorRoute('/models/metadata')).toBe(true)
    expect(isOperatorRoute('/guide')).toBe(true)
    expect(isOperatorRoute('/guide/codex')).toBe(true)
  })
})
