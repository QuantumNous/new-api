import * as Vue from 'vue'
import type { AnyRouter } from '@tanstack/router-core'

export const routerContext = Symbol(
  'TanStackRouter',
) as Vue.InjectionKey<AnyRouter>

/**
 * Provides the router to all child components
 */
export function provideRouter(router: AnyRouter): void {
  Vue.provide(routerContext, router)
}

/**
 * Injects the router from the component tree
 */
export function injectRouter(): AnyRouter {
  const router = Vue.inject<AnyRouter | null>(routerContext, null)
  if (!router) {
    throw new Error(
      'No TanStack Router found in component tree. Did you forget to add a RouterProvider component?',
    )
  }
  return router
}
