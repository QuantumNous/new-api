import type { SplitRouteIdentNodes } from '../constants'

export type SplitStrategy = 'lazyFn' | 'lazyRouteComponent'

export type SplitNodeMeta = {
  routeIdent: SplitRouteIdentNodes
  splitStrategy: SplitStrategy
  localImporterIdent: string
  exporterIdent: string
  localExporterIdent: string
}
