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
import { describe, it } from 'node:test'

import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('rejects browser-normalized network-path redirects', () => {
    assert.equal(safeRedirect('/\\\\evil.example', '/dashboard'), '/dashboard')
    assert.equal(safeRedirect('/\t/evil.example', '/dashboard'), '/dashboard')
    assert.equal(
      safeRedirect('/\u0000evil.example', '/dashboard'),
      '/dashboard'
    )
  })

  it('keeps normal same-app paths', () => {
    assert.equal(
      safeRedirect('/dashboard?tab=models#health', '/fallback'),
      '/dashboard?tab=models#health'
    )
  })
})
