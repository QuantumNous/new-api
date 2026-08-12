import type { AnyRouter, Awaitable } from '@tanstack/router-core'
import type { AnyStartInstance } from './createStart.js'

export interface StartEntry {
  startInstance: AnyStartInstance | undefined
}

export interface RouterEntry {
  getRouter: () => Awaitable<AnyRouter>
}
