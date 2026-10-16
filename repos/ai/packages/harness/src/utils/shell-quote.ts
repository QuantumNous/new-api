export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
