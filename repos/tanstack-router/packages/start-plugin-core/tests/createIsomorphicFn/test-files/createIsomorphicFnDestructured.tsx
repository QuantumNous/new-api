import { createIsomorphicFn } from '@tanstack/react-start'

const noImpl = createIsomorphicFn()

const serverOnlyFn = createIsomorphicFn().server(() => 'server')

const clientOnlyFn = createIsomorphicFn().client(() => 'client')

const serverThenClientFn = createIsomorphicFn()
  .server(() => 'server')
  .client(() => 'client')

const clientThenServerFn = createIsomorphicFn()
  .client(() => 'client')
  .server(() => 'server')

function abstractedServerFn() {
  return 'server'
}

const serverOnlyFnAbstracted = createIsomorphicFn().server(abstractedServerFn)

function abstractedClientFn() {
  return 'client'
}

const clientOnlyFnAbstracted = createIsomorphicFn().client(abstractedClientFn)

const serverThenClientFnAbstracted = createIsomorphicFn()
  .server(abstractedServerFn)
  .client(abstractedClientFn)

const clientThenServerFnAbstracted = createIsomorphicFn()
  .client(abstractedClientFn)
  .server(abstractedServerFn)
