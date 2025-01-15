import './vue'
import { VueRouter, RouterLink, RouterView, START_LOCATION, NavigationFailureType, isNavigationFailure } from './router'

export default VueRouter
export { RouterView, RouterLink, START_LOCATION, NavigationFailureType, isNavigationFailure }

export type {
  RouterMode,
  RouteMeta,
  RawLocation,
  RedirectOption,
  RouterOptions,
  RouteConfig,
  RouteRecord,
  RouteRecordPublic,
  Location,
  Route,
  NavigationGuard,
  NavigationGuardNext,
  NavigationFailure
} from './router'

import './composables'
