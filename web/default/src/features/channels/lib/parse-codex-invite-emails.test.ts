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
import { parseCodexInviteEmails } from './parse-codex-invite-emails'

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key

describe('parseCodexInviteEmails', () => {
  it('splits common separators and deduplicates case-insensitively', () => {
    expect(
      parseCodexInviteEmails('a@example.com, b@example.com\nA@example.com', t)
    ).toEqual(['a@example.com', 'b@example.com'])
  })

  it('rejects empty, invalid, and too many emails', () => {
    expect(() => parseCodexInviteEmails('', t)).toThrow(
      'Enter at least one invite email'
    )
    expect(() => parseCodexInviteEmails('bad-email', t)).toThrow(
      'Invalid invite email'
    )
    expect(() =>
      parseCodexInviteEmails(
        'a@e.com b@e.com c@e.com d@e.com e@e.com f@e.com',
        t
      )
    ).toThrow('Up to {{max}} invite emails at a time')
  })
})
