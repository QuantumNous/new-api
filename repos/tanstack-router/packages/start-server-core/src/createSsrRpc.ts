import { TSS_SERVER_FUNCTION } from '@tanstack/start-client-core'
import { getServerFnById } from './getServerFnById'
import type { ClientFnMeta } from '@tanstack/start-client-core'

export const createSsrRpc = (functionId: string) => {
  const url = process.env.TSS_SERVER_FN_BASE + functionId
  const serverFnMeta: ClientFnMeta = { id: functionId }

  const fn = async (...args: Array<any>): Promise<any> => {
    const serverFn = await getServerFnById(functionId, { origin: 'server' })
    return serverFn(...args)
  }

  return Object.assign(fn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true,
  })
}
