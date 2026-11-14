export function createFakeFn() {
  return {
    handler: (cb: () => Promise<any>) => cb,
  }
}
