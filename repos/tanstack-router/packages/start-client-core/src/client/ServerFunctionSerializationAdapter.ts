import { createSerializationAdapter } from '@tanstack/router-core'
import { TSS_SERVER_FUNCTION } from '../constants'
import { createClientRpc } from '../client-rpc/createClientRpc'

export const ServerFunctionSerializationAdapter = createSerializationAdapter({
  key: '$TSS/serverfn',
  test: (v): v is { serverFnMeta: { id: string } } => {
    if (typeof v !== 'function') return false

    if (!(TSS_SERVER_FUNCTION in v)) return false

    return !!v[TSS_SERVER_FUNCTION]
  },
  toSerializable: ({ serverFnMeta }) => ({ functionId: serverFnMeta.id }),
  fromSerializable: ({ functionId }) => createClientRpc(functionId),
})
