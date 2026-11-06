export default (value: unknown): value is Function =>
  typeof value === 'function';
