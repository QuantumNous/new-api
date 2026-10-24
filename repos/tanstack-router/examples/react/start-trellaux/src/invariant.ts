export function invariant(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new Error(message ?? 'Invariant failed')
  }
}
