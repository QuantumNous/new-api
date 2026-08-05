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
/**
 * Utility functions for API keys
 */

/**
 * Check if an API key is expired based on expired_time
 * @param expired_time - Unix timestamp in seconds (-1 means never expires)
 * @returns true if the key is expired
 */
export function isApiKeyExpired(expired_time: number): boolean {
  if (expired_time === -1) return false
  return expired_time < Date.now() / 1000
}

/**
 * Check if an API key is quota-exhausted based on remain_quota
 * @param remain_quota - Remaining quota
 * @param unlimited_quota - Whether the key has unlimited quota
 * @returns true if the key is exhausted
 */
export function isApiKeyExhausted(
  remain_quota: number,
  unlimited_quota: boolean
): boolean {
  if (unlimited_quota) return false
  return remain_quota <= 0
}
