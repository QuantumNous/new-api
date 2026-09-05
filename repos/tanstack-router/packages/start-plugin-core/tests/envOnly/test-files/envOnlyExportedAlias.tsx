import { createServerOnlyFn as so } from '@tanstack/react-start'

export const fn = so(() => 'server-only-value')
export const wrappedFn = so(() => 'wrapped-server-only-value') as () => string
