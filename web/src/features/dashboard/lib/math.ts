/**
 * Rounds a number to a specified number of significant digits.
 *
 * @example
 * roundToSignificantDigits(18250, 2)   // 18000
 * roundToSignificantDigits(73750, 2)   // 74000
 * roundToSignificantDigits(0.07375, 2) // 0.074
 */
export function roundToSignificantDigits(num: number, digits: number): number {
  if (num === 0) {
    return 0
  }

  const d = Math.ceil(Math.log10(num < 0 ? -num : num))
  const power = digits - d
  const magnitude = Math.pow(10, power)
  const shifted = Math.round(num * magnitude)
  return shifted / magnitude
}

/**
 * Calculates a "nice" ceiling for a chart axis domain.
 * This function takes a maximum data value and returns a rounded-up
 * value that is pleasant for a chart axis (e.g., a multiple of 1, 2, 5, or 10).
 * It ensures the axis range is slightly larger than the data range,
 * preventing data from sitting at the very edge of the chart.
 *
 * @param num The maximum value from the data.
 * @param ticks The desired number of ticks on the axis.
 * @returns A "nice" ceiling value for the axis domain.
 *
 * @example
 * calculateNiceCeiling(366, 5) // returns 400
 * calculateNiceCeiling(18250, 5) // returns 20000
 */
export function calculateNiceCeiling(num: number, ticks: number = 5): number {
  if (num === 0) return 0

  const tickCount = Math.max(1, ticks - 1)
  // Calculate an initial increment
  const increment = num / tickCount
  // Get the magnitude of the increment
  const power = Math.floor(Math.log10(increment))
  const magnitude = Math.pow(10, power)
  // Get the residual of the increment
  const residual = increment / magnitude

  // Find the smallest "nice number" greater than or equal to the residual
  const niceNumbers = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  const niceResidual = niceNumbers.find((n) => n >= residual) || 10

  const niceIncrement = niceResidual * magnitude
  return niceIncrement * tickCount
}
