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
import type { CodexInviteSendResponse } from '../api'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function getCodexInviteFailedEmails(
  response: CodexInviteSendResponse
): string[] {
  const rootFailed = response.data?.failed_emails
  if (isStringArray(rootFailed)) return rootFailed

  const nested = response.data?.data
  if (nested && typeof nested === 'object') {
    const nestedFailed = (nested as { failed_emails?: unknown }).failed_emails
    if (isStringArray(nestedFailed)) return nestedFailed
  }

  return []
}
