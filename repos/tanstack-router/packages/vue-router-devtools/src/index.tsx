import { defineComponent } from 'vue'
import { TanStackRouterDevtools as DevToolsComponent } from './TanStackRouterDevtools'
import { TanStackRouterDevtoolsPanel as DevToolsPanelComponent } from './TanStackRouterDevtoolsPanel'

// Re-export types
export type { TanStackRouterDevtoolsOptions } from './TanStackRouterDevtools'
export type { TanStackRouterDevtoolsPanelOptions } from './TanStackRouterDevtoolsPanel'

// Create a null component for production
const NullComponent = /* #__PURE__ */ defineComponent({
  name: 'NullTanStackRouterDevtools',
  setup() {
    return () => null
  },
})

export const TanStackRouterDevtools =
  process.env.NODE_ENV !== 'development' ? NullComponent : DevToolsComponent

export const TanStackRouterDevtoolsInProd = DevToolsComponent

export const TanStackRouterDevtoolsPanel =
  process.env.NODE_ENV !== 'development'
    ? NullComponent
    : DevToolsPanelComponent

export const TanStackRouterDevtoolsPanelInProd = DevToolsPanelComponent
