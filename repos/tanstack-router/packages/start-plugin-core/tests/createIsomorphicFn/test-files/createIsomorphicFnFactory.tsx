import { createIsomorphicFn } from '@tanstack/react-start'

// Isomorphic function factory - returns a createIsomorphicFn with .client() and .server() calls
export function createPlatformFn(platform: string) {
  return createIsomorphicFn()
    .client(() => `client-${platform}`)
    .server(() => `server-${platform}`)
}

// Arrow function factory with only server implementation
export const createServerImplFn = (name: string) => {
  return createIsomorphicFn().server(() => {
    console.log(`Server: ${name}`)
    return `server-${name}`
  })
}

// Arrow function factory with only client implementation
export const createClientImplFn = (name: string) => {
  return createIsomorphicFn().client(() => {
    console.log(`Client: ${name}`)
    return `client-${name}`
  })
}

// Factory returning no-implementation isomorphic fn
export function createNoImplFn() {
  return createIsomorphicFn()
}

// Top-level isomorphic fn for comparison
export const topLevelIsomorphicFn = createIsomorphicFn()
  .client(() => 'client')
  .server(() => 'server')
