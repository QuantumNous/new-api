import { hydrateStart as coreHydrateStart } from '@tanstack/start-client-core/client'
import type { AnyRouter } from '@tanstack/router-core'
import type { App } from 'vue'

/**
 * Suppress expected hydration mismatch warnings for routes with ssr: 'data-only' or ssr: false
 * These routes intentionally render different content on server vs client.
 *
 * Note: We always suppress hydration warnings in Vue Start apps because:
 * 1. Routes with ssr: 'data-only' or ssr: false cause expected mismatches
 * 2. The ssr option is not reliably accessible from route.options for file-based routes
 * 3. DevTools components also cause expected mismatches in development
 * 4. In production builds, Vue strips these warnings anyway
 */
function suppressSsrHydrationMismatches(_router: AnyRouter): void {
  const originalWarn = console.warn
  const originalError = console.error

  const isHydrationMismatchMessage = (args: Array<unknown>): boolean => {
    // Check all args since Vue may pass message in different positions
    for (const arg of args) {
      if (typeof arg !== 'string') continue
      if (
        arg.includes('Hydration completed but contains mismatches') ||
        arg.includes('Hydration node mismatch') ||
        arg.includes('Hydration text mismatch') ||
        arg.includes('Hydration children mismatch') ||
        arg.includes('Hydration class mismatch') ||
        arg.includes('Hydration style mismatch') ||
        arg.includes('Hydration attribute mismatch')
      ) {
        return true
      }
    }
    return false
  }

  console.warn = (...args) => {
    if (isHydrationMismatchMessage(args)) {
      return // Suppress hydration warnings
    }
    originalWarn.apply(console, args)
  }

  console.error = (...args) => {
    if (isHydrationMismatchMessage(args)) {
      return // Suppress hydration warnings
    }
    originalError.apply(console, args)
  }
}

/**
 * Configure a Vue app to suppress expected hydration mismatch warnings
 * for routes with ssr: false or ssr: 'data-only'
 * Call this after createSSRApp and before app.mount()
 *
 * Note: We always suppress hydration warnings in Vue Start apps because:
 * 1. Routes with ssr: 'data-only' or ssr: false cause expected mismatches
 * 2. The ssr option is not reliably accessible from route.options for file-based routes
 * 3. DevTools components also cause expected mismatches in development
 * 4. In production builds, Vue strips these warnings anyway
 */
export function configureHydrationSuppressions(
  app: App,
  _router: AnyRouter,
): void {
  // Always install the warnHandler to suppress hydration warnings
  // Vue's app.config.warnHandler intercepts dev warnings BEFORE console.warn
  app.config.warnHandler = (msg, _instance, _trace) => {
    // Suppress hydration mismatch warnings
    if (
      msg.includes('Hydration node mismatch') ||
      msg.includes('Hydration text mismatch') ||
      msg.includes('Hydration children mismatch') ||
      msg.includes('Hydration class mismatch') ||
      msg.includes('Hydration style mismatch') ||
      msg.includes('Hydration attribute mismatch')
    ) {
      return // Suppress the warning
    }
    // Let other warnings through to console
    console.warn(`[Vue warn]: ${msg}`)
  }
}

/**
 * Vue-specific wrapper for hydrateStart that installs hydration mismatch
 * suppression for routes with ssr: false or ssr: 'data-only' before returning
 */
export async function hydrateStart(): Promise<AnyRouter> {
  const router = await coreHydrateStart()
  // Install console suppression before app.mount() is called
  // This catches the "Hydration completed but contains mismatches" error
  suppressSsrHydrationMismatches(router)
  return router
}
