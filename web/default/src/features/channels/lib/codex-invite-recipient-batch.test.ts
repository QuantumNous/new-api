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
import { describe, expect, it } from 'bun:test'
import { getCodexInviteRecipientBatchKey } from './codex-invite-recipient-batch'

describe('getCodexInviteRecipientBatchKey', () => {
  it('normalizes case, spacing, and ordering for the same recipient batch', () => {
    expect(
      getCodexInviteRecipientBatchKey('A@example.com, b@example.com\n')
    ).toBe(getCodexInviteRecipientBatchKey('b@example.com a@example.com'))
  })

  it('changes when the recipient batch changes or is cleared', () => {
    expect(getCodexInviteRecipientBatchKey('a@example.com')).not.toBe(
      getCodexInviteRecipientBatchKey('a@example.com c@example.com')
    )
    expect(getCodexInviteRecipientBatchKey('a@example.com')).not.toBe(
      getCodexInviteRecipientBatchKey('')
    )
  })
})
