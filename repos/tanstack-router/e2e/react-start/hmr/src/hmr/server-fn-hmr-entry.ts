import { createServerFn } from '@tanstack/react-start'
import {
  createServerFnHmrFactory,
  serverFnHmrMarker,
} from './server-fn-hmr-factory'

const serverOnlyImpl = createServerFnHmrFactory(
  () => 'server-fn-hmr-baseline-result',
)

const serverFnHmr = createServerFn().handler(async () => {
  return {
    result: await serverOnlyImpl(),
  }
})

export { serverFnHmrMarker }

export async function invokeServerFnHmr() {
  return serverFnHmr()
}
