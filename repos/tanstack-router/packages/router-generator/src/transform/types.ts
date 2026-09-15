import type { RouteNode } from '../types'
import type { Config } from '../config'

export interface TransformOptions {
  source: string
  filename?: string
  ctx: TransformContext
  node: RouteNode
}

export type TransformResult =
  | {
      result: 'no-route-export'
    }
  | {
      result: 'not-modified'
    }
  | {
      result: 'modified'
      output: string
    }
  | {
      result: 'error'
      error?: any
    }

export interface TransformContext {
  target: Config['target']
  routeId: string
  lazy: boolean
}
