import { createReactRefreshIgnoredRouteExportsPlugin } from './react-refresh-ignored-route-exports'
import { createReactRefreshRouteComponentsPlugin } from './react-refresh-route-components'
import { createReactStableHmrSplitRouteComponentsPlugin } from './react-stable-hmr-split-route-components'
import type { ReferenceRouteCompilerPlugin } from '../plugins'
import type { Config, HmrStyle } from '../../config'

export function getReferenceRouteCompilerPlugins(opts: {
  targetFramework: Config['target']
  addHmr?: boolean
  hmrStyle?: HmrStyle
}): Array<ReferenceRouteCompilerPlugin> | undefined {
  switch (opts.targetFramework) {
    case 'react': {
      if (opts.addHmr) {
        const hmrStyle = opts.hmrStyle ?? 'vite'
        return [
          ...(hmrStyle === 'vite'
            ? [createReactRefreshIgnoredRouteExportsPlugin()]
            : []),
          createReactRefreshRouteComponentsPlugin(),
          createReactStableHmrSplitRouteComponentsPlugin({ hmrStyle }),
        ]
      }
      return undefined
    }
    default:
      return undefined
  }
}
