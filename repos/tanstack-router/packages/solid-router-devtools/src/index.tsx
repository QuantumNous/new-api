import * as Devtools from './TanStackRouterDevtools'
import * as DevtoolsPanel from './TanStackRouterDevtoolsPanel'

export const TanStackRouterDevtools: (typeof Devtools)['TanStackRouterDevtools'] =
  process.env.NODE_ENV !== 'development'
    ? function () {
        return null
      }
    : Devtools.TanStackRouterDevtools

export const TanStackRouterDevtoolsInProd: (typeof Devtools)['TanStackRouterDevtools'] =
  Devtools.TanStackRouterDevtools

export const TanStackRouterDevtoolsPanel: (typeof DevtoolsPanel)['TanStackRouterDevtoolsPanel'] =
  process.env.NODE_ENV !== 'development'
    ? function () {
        return null
      }
    : DevtoolsPanel.TanStackRouterDevtoolsPanel

export const TanStackRouterDevtoolsPanelInProd: (typeof DevtoolsPanel)['TanStackRouterDevtoolsPanel'] =
  DevtoolsPanel.TanStackRouterDevtoolsPanel
