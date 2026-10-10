import { createSerializationAdapter } from '@tanstack/router-core'
import { TSS_SERVER_FUNCTION } from '@tanstack/start-client-core'
import { getServerFnById } from '../getServerFnById'

export const ServerFunctionSerializationAdapter = createSerializationAdapter({
  key: '$TSS/serverfn',
  test: (v): v is { serverFnMeta: { id: string } } => {
    if (typeof v !== 'function') return false

    if (!(TSS_SERVER_FUNCTION in v)) return false

    return !!v[TSS_SERVER_FUNCTION]
  },
  toSerializable: ({ serverFnMeta }) => ({ functionId: serverFnMeta.id }),
  fromSerializable: ({ functionId }) => {
    const fn = async (opts: any, signal: any): Promise<any> => {
      // When a function ID is received through serialization (e.g., as a parameter
      // to another server function), it originates from the client and must be
      // validated the same way as direct HTTP calls to server functions.
      const serverFn = await getServerFnById(functionId, { origin: 'client' })
      const result = await serverFn(opts ?? {}, signal)
      return result.result
    }
    return fn as never
  },
})
