export default <T>(value: T | T[]): undefined[] | undefined =>
  Array.isArray(value) ? value.map(() => undefined) : undefined;
