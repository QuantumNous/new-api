let counter = 0;
export function generateId(prefix: string) {
  counter += 1;
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}-${counter}`;
}
