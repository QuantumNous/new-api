export function throwMissingPropError(field: string): never {
  throw new Error(`missing "${field}" in options

  > describeConformance(element, () => options)
`);
}
