'use client'

import { Suspense } from 'react'
import ReactDOM from 'react-dom'

import {
  RSC_PROXY_GET_TREE,
  RSC_PROXY_PATH,
  SERVER_COMPONENT_CSS_HREFS,
  SERVER_COMPONENT_JS_PRELOADS,
} from './ServerComponentTypes'

function EmptyFallback() {
  return null
}

function RscNodeRenderInner({
  getTree,
  path,
}: {
  getTree: () => unknown
  path: Array<string>
}): React.ReactNode {
  let tree: unknown = getTree()

  for (const key of path) {
    if (tree === null || tree === undefined) return null
    if (typeof tree !== 'object') return null
    tree = (tree as Record<string, unknown>)[key]
  }

  if (tree === null || tree === undefined) return null

  // No SlotProvider - just return the tree directly
  return tree as React.ReactNode
}

/**
 * Renders a renderable RSC proxy without slot support.
 * Used internally by the renderable proxy's $$typeof/type masquerade.
 */
export function RscNodeRenderer({ data }: { data: any }): React.ReactNode {
  const cssHrefs = data[SERVER_COMPONENT_CSS_HREFS] as
    | ReadonlySet<string>
    | undefined
  const jsPreloads = data[SERVER_COMPONENT_JS_PRELOADS] as
    | ReadonlySet<string>
    | undefined

  const path = (data[RSC_PROXY_PATH] as Array<string> | undefined) ?? []

  const getTree = data[RSC_PROXY_GET_TREE] as (() => unknown) | undefined
  if (!getTree) {
    throw new Error(
      '[tanstack/start] RscNodeRenderer missing getTree on RSC data.',
    )
  }

  for (const href of cssHrefs ?? []) {
    ReactDOM.preinit(href, { as: 'style', precedence: 'high' })
  }

  if (jsPreloads) {
    for (const href of jsPreloads) {
      ReactDOM.preloadModule(href)
    }
  }

  return (
    <>
      <Suspense fallback={<EmptyFallback />}>
        <RscNodeRenderInner getTree={getTree} path={path} />
      </Suspense>
    </>
  )
}
