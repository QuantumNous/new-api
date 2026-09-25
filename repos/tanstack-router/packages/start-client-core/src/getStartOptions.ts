import { getStartContext } from '@tanstack/start-storage-context'
import { createIsomorphicFn } from '@tanstack/start-fn-stubs'
import type { AnyStartInstanceOptions } from './createStart'

export const getStartOptions: () => AnyStartInstanceOptions | undefined =
  createIsomorphicFn()
    .client(() => window.__TSS_START_OPTIONS__)
    .server(() => getStartContext().startOptions)
