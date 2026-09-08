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
import type { AgentCodeStatus } from '../types'

const FIXED_AGENT_POINTS = /^-?\d+\.\d{2}$/

/**
 * Adds grouping separators to a server-formatted point value without ever
 * converting it to a JavaScript number. The API contract always has exactly
 * two decimal places.
 */
export function formatAgentPoints(value: string): string {
  if (!FIXED_AGENT_POINTS.test(value)) {
    throw new TypeError('Agent points must be a fixed two-decimal string')
  }

  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [whole, fraction] = unsigned.split('.')
  const grouped = whole.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',')

  return `${negative ? '-' : ''}${grouped}.${fraction}`
}

/**
 * Re-evaluates the only time-dependent code state in the browser. This keeps
 * a previously fetched unused row accurate when its expiry boundary passes.
 */
export function deriveAgentCodeStatus(
  status: AgentCodeStatus,
  expiredAt: number,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): AgentCodeStatus {
  if (status === 'unused' && expiredAt !== 0 && expiredAt <= nowSeconds) {
    return 'expired'
  }

  return status
}
