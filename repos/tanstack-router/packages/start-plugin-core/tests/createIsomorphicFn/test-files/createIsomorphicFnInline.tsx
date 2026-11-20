import { createIsomorphicFn } from '@tanstack/react-start'

// Create and immediately invoke isomorphic fn inside a function
export function getPlatformValue() {
  const fn = createIsomorphicFn()
    .client(() => 'client-value')
    .server(() => 'server-value')
  return fn()
}

// Arrow function that creates and invokes isomorphic fn
export const getEnvironment = () => {
  const envFn = createIsomorphicFn()
    .server(() => 'running on server')
    .client(() => 'running on client')
  return envFn()
}

// Create isomorphic fn inline without assigning to variable
export function getDirectValue() {
  return createIsomorphicFn()
    .client(() => 'direct-client')
    .server(() => 'direct-server')()
}

// Multiple isomorphic fns created and used in same function
export function getMultipleValues() {
  const first = createIsomorphicFn()
    .client(() => 'first-client')
    .server(() => 'first-server')

  const second = createIsomorphicFn()
    .client(() => 'second-client')
    .server(() => 'second-server')

  return { first: first(), second: second() }
}

// Isomorphic fn with server-only implementation used inline
export function getServerOnlyValue() {
  const fn = createIsomorphicFn().server(() => {
    console.log('server side effect')
    return 'server-only-value'
  })
  return fn()
}

// Isomorphic fn with client-only implementation used inline
export function getClientOnlyValue() {
  const fn = createIsomorphicFn().client(() => {
    console.log('client side effect')
    return 'client-only-value'
  })
  return fn()
}
