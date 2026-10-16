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
