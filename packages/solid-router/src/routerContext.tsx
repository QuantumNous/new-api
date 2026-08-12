import * as Solid from 'solid-js'
import type { AnyRouter } from '@tanstack/router-core'

export const routerContext = Solid.createContext<AnyRouter>(
  null as unknown as AnyRouter,
)
