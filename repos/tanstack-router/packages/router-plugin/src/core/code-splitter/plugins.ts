import type babel from '@babel/core'
import type * as t from '@babel/types'
import type { Config, DeletableNodes, HmrStyle } from '../config'
import type { CodeSplitGroupings } from '../constants'
import type { SplitNodeMeta } from './types'

export type CompileCodeSplitReferenceRouteOptions = {
  codeSplitGroupings: CodeSplitGroupings
  deleteNodes?: Set<DeletableNodes>
  targetFramework: Config['target']
  filename: string
  id: string
  addHmr?: boolean
  hmrStyle?: HmrStyle
  hmrRouteId?: string
  sharedBindings?: Set<string>
}

export type ReferenceRouteCompilerPluginContext = {
  programPath: babel.NodePath<t.Program>
  callExpressionPath: babel.NodePath<t.CallExpression>
  insertionPath: babel.NodePath
  routeOptions: t.ObjectExpression
  createRouteFn: string
  opts: CompileCodeSplitReferenceRouteOptions
}

export type ReferenceRouteSplitPropertyCompilerPluginContext = {
  programPath: babel.NodePath<t.Program>
  callExpressionPath: babel.NodePath<t.CallExpression>
  insertionPath: babel.NodePath
  routeOptions: t.ObjectExpression
  prop: t.ObjectProperty
  splitNodeMeta: SplitNodeMeta
  lazyRouteComponentIdent: string
  opts: CompileCodeSplitReferenceRouteOptions
}

export type ReferenceRouteCompilerPluginResult = {
  modified?: boolean
}

export type ReferenceRouteCompilerPlugin = {
  name: string
  getStableRouteOptionKeys?: () => Array<string>
  onRouteOptions?: (
    ctx: ReferenceRouteCompilerPluginContext,
  ) => void | ReferenceRouteCompilerPluginResult
  onAddHmr?: (
    ctx: ReferenceRouteCompilerPluginContext,
  ) => void | ReferenceRouteCompilerPluginResult
  onUnsplittableRoute?: (
    ctx: ReferenceRouteCompilerPluginContext,
  ) => void | ReferenceRouteCompilerPluginResult
  onSplitRouteProperty?: (
    ctx: ReferenceRouteSplitPropertyCompilerPluginContext,
  ) => void | t.Expression
}
