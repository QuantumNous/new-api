export function print(
  label: string,
  value: unknown,
  options: { depth?: number } = { depth: Infinity },
): void {
  console.log(label);
  console.dir(removeUndefinedEntries(value), { depth: options.depth });
}

function removeUndefinedEntries(record: unknown): unknown {
  if (record == null || typeof record !== 'object') {
    return record;
  }
  if (record instanceof Array) {
    return record.map(removeUndefinedEntries);
  }
  return Object.fromEntries(
    Object.entries(record)
      .filter(([_key, value]) => value != null)
      .map(([key, value]) => [key, removeUndefinedEntries(value)]),
  );
}
