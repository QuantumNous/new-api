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
import { getFreshAuthHeaders } from '@/lib/api'

import { syncStatusToRelease } from './hw-sync-status'
import type { SystemRelease } from './releases'

// The Content-Security-Policy keeps connect-src at 'self', so the server asks
// GitHub on our behalf and caches the answer for an hour. Our sync status sits
// behind the same gate and answers one record, not a release list.
// Plain fetch on purpose: the shared api client would send a failed check to
// the sign-in page. The access token is short-lived, so the headers come from
// the refreshing helper; reading the stored token directly gave 401 as soon as
// it expired.
export const SYSTEM_RELEASES_URL = '/api/hw/sync-status'

export type UpdateCheckErrorCode =
  | 'network'
  | 'rate-limit'
  | 'timeout'
  | 'payload'

export class UpdateCheckError extends Error {
  constructor(public readonly code: UpdateCheckErrorCode) {
    super(code)
    this.name = 'UpdateCheckError'
  }
}

export async function fetchLatestSystemRelease(
  signal: AbortSignal
): Promise<SystemRelease | null> {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) controller.abort()
  const timeout = setTimeout(cancel, 10_000)

  try {
    const response = await fetch(SYSTEM_RELEASES_URL, {
      credentials: 'same-origin',
      headers: await getFreshAuthHeaders(),
      signal: controller.signal,
    })
    if (response.status === 429) {
      throw new UpdateCheckError('rate-limit')
    }
    if (!response.ok) throw new UpdateCheckError('network')

    try {
      return syncStatusToRelease(await response.json())
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new UpdateCheckError('payload')
    }
  } catch (error) {
    if (signal.aborted) throw error
    if (controller.signal.aborted) throw new UpdateCheckError('timeout')
    if (error instanceof UpdateCheckError) throw error
    throw new UpdateCheckError('network')
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}
