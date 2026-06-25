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
const maxCodexInviteEmails = 5
const codexInviteEmailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Translate = (key: string, options?: Record<string, unknown>) => string

export function parseCodexInviteEmails(input: string, t: Translate): string[] {
  const emails = input
    .split(/[,\s;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const unique: string[] = []
  for (const email of emails) {
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(email)
  }

  if (unique.length === 0) throw new Error(t('Enter at least one invite email'))
  if (unique.length > maxCodexInviteEmails) {
    throw new Error(
      t('Up to {{max}} invite emails at a time', {
        max: maxCodexInviteEmails,
      })
    )
  }

  const invalid = unique.find((email) => !codexInviteEmailPattern.test(email))
  if (invalid) {
    throw new Error(t('Invalid invite email: {{email}}', { email: invalid }))
  }
  return unique
}

export { maxCodexInviteEmails }
