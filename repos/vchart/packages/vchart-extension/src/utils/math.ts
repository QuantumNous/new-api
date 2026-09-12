export function isNumberEqual(a: number, b: number, precision = 1): boolean {
  return Math.abs(a - b) < precision;
}
