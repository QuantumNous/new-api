import { createClientOnlyFn, createServerOnlyFn } from '@tanstack/react-start'

export const createServerFnHmrFactory = createServerOnlyFn
export const serverFnHmrMarker = 'server-fn-hmr-baseline'
