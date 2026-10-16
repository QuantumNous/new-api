import { TSS_SERVER_FUNCTION } from '../constants'
import { getStartOptions } from '../getStartOptions'
import { serverFnFetcher } from './serverFnFetcher'
import type { ClientFnMeta } from '../constants'

export function createClientRpc(functionId: string) {
  const url = process.env.TSS_SERVER_FN_BASE + functionId
  const serverFnMeta: ClientFnMeta = { id: functionId }

  const clientFn = (...args: Array<any>) => {
    const startFetch = getStartOptions()?.serverFns?.fetch
    return serverFnFetcher(url, args, startFetch ?? fetch)
  }

  return Object.assign(clientFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true,
  })
}
