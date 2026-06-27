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
import { USER_ROLE, USER_STATUS, isUserDeleted } from '../constants'
import type { ApiResponse, User } from '../types'

export type DisableUsersBatchResult = {
  successCount: number
  failedCount: number
}

const DISABLE_USERS_BATCH_CONCURRENCY = 5

export function canDisableUser(user: User): boolean {
  if (isUserDeleted(user)) return false
  if (user.status === USER_STATUS.DISABLED) return false
  if (user.role === USER_ROLE.ROOT) return false

  return true
}

export function getBatchDisableUserTargets(users: User[]): User[] {
  return users.filter(canDisableUser)
}

export async function disableUsersBatch(
  users: User[],
  disableUser: (user: User) => Promise<ApiResponse<Partial<User>>>
): Promise<DisableUsersBatchResult> {
  const targets = getBatchDisableUserTargets(users)
  const results: PromiseSettledResult<ApiResponse<Partial<User>>>[] = []

  for (
    let index = 0;
    index < targets.length;
    index += DISABLE_USERS_BATCH_CONCURRENCY
  ) {
    const batch = targets.slice(index, index + DISABLE_USERS_BATCH_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map((user) => disableUser(user))
    )
    results.push(...batchResults)
  }

  const successCount = results.filter((result) => {
    return result.status === 'fulfilled' && result.value.success
  }).length

  return {
    successCount,
    failedCount: results.length - successCount,
  }
}
