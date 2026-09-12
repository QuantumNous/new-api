export { useServerFn } from './useServerFn'
export * from '@tanstack/start-client-core'
// Explicit re-exports shadow `export *` above so these public-API names are
// registered on the namespace at link time (via Vite SSR's `defineExport`
// at fileStartIndex), surviving the cold-start SSR cycle through user
// middleware. See vitejs/vite#22491 / #22493. Trim list to genuine public
// API only; internals fall through `export *` and are safe because they
// aren't imported at top level in the cycle path.
export {
  createClientOnlyFn,
  createCsrfMiddleware,
  createIsomorphicFn,
  createMiddleware,
  createServerFn,
  createServerOnlyFn,
  createStart,
} from '@tanstack/start-client-core'

// Keep root `@tanstack/react-start` imports from evaluating the client barrel.
// The barrel also exports `hydrateStart`, which imports the virtual client
// entry. That virtual entry imports the user's router module, so route modules
// that import the root package can be pulled back into the same graph and
// create circular HMR updates. Re-exporting from the Hydrate-only subpath
// preserves the public API without introducing that import edge.
export { Hydrate } from '@tanstack/react-start-client/Hydrate'
export type {
  HydrateOptions,
  HydrateProps,
  HydrationInteractionEvent,
  HydrationInteractionEvents,
  HydrationPrefetchStrategy,
  HydrationStrategy,
  HydrationWhen,
} from '@tanstack/react-start-client/Hydrate'
