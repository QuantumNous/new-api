import { createIsomorphicFn as isomorphicFn } from '@tanstack/react-start'

const noImpl = isomorphicFn()

const serverOnlyFn = isomorphicFn().server(() => 'server')

const clientOnlyFn = isomorphicFn().client(() => 'client')

const serverThenClientFn = isomorphicFn()
  .server(() => 'server')
  .client(() => 'client')

const clientThenServerFn = isomorphicFn()
  .client(() => 'client')
  .server(() => 'server')

function abstractedServerFn() {
  return 'server'
}

const serverOnlyFnAbstracted = isomorphicFn().server(abstractedServerFn)

function abstractedClientFn() {
  return 'client'
}

const clientOnlyFnAbstracted = isomorphicFn().client(abstractedClientFn)

const serverThenClientFnAbstracted = isomorphicFn()
  .server(abstractedServerFn)
  .client(abstractedClientFn)

const clientThenServerFnAbstracted = isomorphicFn()
  .client(abstractedClientFn)
  .server(abstractedServerFn)
