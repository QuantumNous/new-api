/**
 * Utility functions for redemption codes
 */

/**
 * Check if a Unix timestamp (in seconds) is expired
 * @param timestamp - Unix timestamp in seconds (0 means never expires)
 * @returns true if the timestamp is in the past
 */
export function isTimestampExpired(timestamp: number): boolean {
  if (timestamp === 0) return false
  return timestamp < Date.now() / 1000
}

/**
 * Check if redemption code is expired based on business logic
 * Only enabled redemption codes (status === 1) can be considered expired
 * @param expired_time - Unix timestamp in seconds (0 means never expires)
 * @param status - Redemption status (1: enabled, 2: disabled, 3: used)
 * @returns true if the code is expired
 */
export function isRedemptionExpired(
  expired_time: number,
  status: number
): boolean {
  return status === 1 && isTimestampExpired(expired_time)
}
