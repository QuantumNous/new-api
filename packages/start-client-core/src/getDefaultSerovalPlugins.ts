import {
  makeSerovalPlugin,
  defaultSerovalPlugins as routerDefaultSerovalPlugins,
} from '@tanstack/router-core'
import { getStartOptions } from './getStartOptions'
import type { AnySerializationAdapter } from '@tanstack/router-core'
import type { Plugin } from 'seroval'

export function getDefaultSerovalPlugins(): Array<Plugin<any, any>> {
  const start = getStartOptions()
  const adapters = start?.serializationAdapters as
    | Array<AnySerializationAdapter>
    | undefined
  return [
    ...(adapters?.map(makeSerovalPlugin) ?? []),
    ...routerDefaultSerovalPlugins,
  ]
}
