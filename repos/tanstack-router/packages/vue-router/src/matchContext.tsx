import * as Vue from 'vue'

// Reactive nearest-match context used by hooks that work relative to the
// current match in the tree.
export const matchContext = Symbol('TanStackRouterMatch') as Vue.InjectionKey<
  Vue.Ref<string | undefined>
>

// Pending match context for nearest-match lookups
export const pendingMatchContext = Symbol(
  'TanStackRouterPendingMatch',
) as Vue.InjectionKey<Vue.Ref<boolean>>

// Dummy pending context when nearest pending state is not needed
export const dummyPendingMatchContext = Symbol(
  'TanStackRouterDummyPendingMatch',
) as Vue.InjectionKey<Vue.Ref<boolean>>

// Stable routeId context — a plain string (not reactive) that identifies
// which route this component belongs to. Provided by Match, consumed by
// MatchInner, Outlet, and useMatch for routeId-based store lookups.
export const routeIdContext = Symbol(
  'TanStackRouterRouteId',
) as Vue.InjectionKey<string>

/**
 * Retrieves nearest pending-match state from the component tree
 */
export function injectPendingMatch(): Vue.Ref<boolean> {
  return Vue.inject(pendingMatchContext, Vue.ref(false))
}

/**
 * Retrieves dummy pending-match state from the component tree
 * This only exists so we can conditionally inject a value when we are not interested in the nearest pending match
 */
export function injectDummyPendingMatch(): Vue.Ref<boolean> {
  return Vue.inject(dummyPendingMatchContext, Vue.ref(false))
}
