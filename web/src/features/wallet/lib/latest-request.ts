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
export type LatestRequestGuard = {
  activate: () => void
  deactivate: () => void
  begin: () => number
  isCurrent: (requestID: number) => boolean
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let active = false
  let latestRequestID = 0
  return {
    activate() {
      active = true
      latestRequestID += 1
    },
    deactivate() {
      active = false
      latestRequestID += 1
    },
    begin() {
      latestRequestID += 1
      return latestRequestID
    },
    isCurrent(requestID) {
      return active && requestID === latestRequestID
    },
  }
}

export async function runLatestRequest<T>(
  guard: LatestRequestGuard,
  request: () => Promise<T>,
  commit: (value: T) => void,
  settle?: () => void
): Promise<boolean> {
  const requestID = guard.begin()
  try {
    const value = await request()
    if (!guard.isCurrent(requestID)) return false
    commit(value)
    return true
  } finally {
    if (guard.isCurrent(requestID)) settle?.()
  }
}
