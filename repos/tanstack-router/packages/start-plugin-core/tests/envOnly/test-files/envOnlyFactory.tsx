import { createServerOnlyFn, createClientOnlyFn } from '@tanstack/react-start'

// Server-only function factory
export function createServerFactory(name: string) {
  return createServerOnlyFn(() => {
    console.log(`Server only: ${name}`)
    return `server-${name}`
  })
}

// Client-only function factory
export function createClientFactory(name: string) {
  return createClientOnlyFn(() => {
    console.log(`Client only: ${name}`)
    return `client-${name}`
  })
}

// Arrow function server factory
export const createServerArrowFactory = (prefix: string) => {
  return createServerOnlyFn(() => `${prefix}-server`)
}

// Arrow function client factory
export const createClientArrowFactory = (prefix: string) => {
  return createClientOnlyFn(() => `${prefix}-client`)
}

// Top-level for comparison
export const topLevelServerFn = createServerOnlyFn(() => 'server')
export const topLevelClientFn = createClientOnlyFn(() => 'client')
