import * as TanStackStart from '@tanstack/react-start'

const noImpl = TanStackStart.createIsomorphicFn()

const serverOnlyFn = TanStackStart.createIsomorphicFn().server(() => 'server')

const clientOnlyFn = TanStackStart.createIsomorphicFn().client(() => 'client')

const serverThenClientFn = TanStackStart.createIsomorphicFn()
  .server(() => 'server')
  .client(() => 'client')

const clientThenServerFn = TanStackStart.createIsomorphicFn()
  .client(() => 'client')
  .server(() => 'server')

function abstractedServerFn() {
  return 'server'
}

const serverOnlyFnAbstracted =
  TanStackStart.createIsomorphicFn().server(abstractedServerFn)

function abstractedClientFn() {
  return 'client'
}

const clientOnlyFnAbstracted =
  TanStackStart.createIsomorphicFn().client(abstractedClientFn)

const serverThenClientFnAbstracted = TanStackStart.createIsomorphicFn()
  .server(abstractedServerFn)
  .client(abstractedClientFn)

const clientThenServerFnAbstracted = TanStackStart.createIsomorphicFn()
  .client(abstractedClientFn)
  .server(abstractedServerFn)
