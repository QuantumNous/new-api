type EnvOnlyFn = <TFn extends (...args: Array<any>) => any>(fn: TFn) => TFn

// A function that will only be available in the server build
// If called on the client, it will throw an error
export const createServerOnlyFn: EnvOnlyFn = (fn) => fn

// A function that will only be available in the client build
// If called on the server, it will throw an error
export const createClientOnlyFn: EnvOnlyFn = (fn) => fn
