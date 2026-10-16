'use client'

import { Suspense } from 'react'
import ReactDOM from 'react-dom'

import { SlotProvider } from './SlotContext'
import {
  RSC_PROXY_GET_TREE,
  RSC_PROXY_PATH,
  SERVER_COMPONENT_CSS_HREFS,
  SERVER_COMPONENT_JS_PRELOADS,
  SERVER_COMPONENT_STREAM,
} from './ServerComponentTypes'
import type { AnyCompositeComponent } from './ServerComponentTypes'
import type { SlotImplementations } from './types'

function splitSlotProps(props?: Record<string, unknown>): {
  implementations: SlotImplementations
  strict: boolean
} {
  const safeProps = props ?? {}
  const { children, strict, ...slotProps } = safeProps as {
    children?: unknown
    strict?: unknown
    [key: string]: unknown
  }

  return {
    implementations: { ...slotProps, children },
    strict: strict === true,
  }
}

function EmptyFallback() {
  return null
}

function CompositeRenderInner({
  getTree,
  path,
  slotProps,
}: {
  getTree: () => unknown
  path: Array<string>
  slotProps?: Record<string, unknown>
}): React.ReactNode {
  let tree: unknown = getTree()

  for (const key of path) {
    if (tree === null || tree === undefined) return null
    if (typeof tree !== 'object') return null
    tree = (tree as Record<string, unknown>)[key]
  }

  if (tree === null || tree === undefined) return null

  const { implementations, strict } = splitSlotProps(slotProps)

  return (
    <SlotProvider implementations={implementations} strict={strict}>
      {tree as React.ReactNode}
    </SlotProvider>
  )
}

function CompositeRenderComponent({
  getTree,
  path,
  slotProps,
  cssHrefs,
  jsPreloads,
}: {
  getTree: () => unknown
  path: Array<string>
  slotProps?: Record<string, unknown>
  cssHrefs?: ReadonlySet<string>
  jsPreloads?: ReadonlySet<string>
}): React.ReactNode {
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
        <CompositeRenderInner
          getTree={getTree}
          path={path}
          slotProps={slotProps}
        />
      </Suspense>
    </>
  )
}

/**
 * Renders composite RSC data with slot support.
 *
 * Use this component to render data from `createCompositeComponent`.
 * Pass slot implementations as props to fill in ClientSlot placeholders.
 *
 * @example
 * ```tsx
 * const src = await createCompositeComponent((props) => (
 *   <div>
 *     <header>{props.header('Dashboard')}</header>
 *     <main>{props.children}</main>
 *   </div>
 * ))
 *
 * // In route component
 * return (
 *   <CompositeComponent src={src} header={(title) => <h1>{title}</h1>}>
 *     <p>Main content</p>
 *   </CompositeComponent>
 * )
 * ```
 */
export function CompositeComponent<TComp extends AnyCompositeComponent>(
  props: CompositeComponentProps<TComp>,
): TComp['~types']['return'] {
  const { src, ...slotProps } = props

  const stream = src[SERVER_COMPONENT_STREAM]

  if (!stream) {
    throw new Error(
      '[tanstack/start] <CompositeComponent> missing RSC stream on src',
    )
  }

  const cssHrefs = src[SERVER_COMPONENT_CSS_HREFS]
  const jsPreloads = src[SERVER_COMPONENT_JS_PRELOADS]

  const path = src[RSC_PROXY_PATH] ?? []

  const getTree = src[RSC_PROXY_GET_TREE]

  if (!getTree) {
    throw new Error(
      '[tanstack/start] <CompositeComponent> missing getTree on RSC src. ' +
        'Make sure src comes from createCompositeComponent().',
    )
  }

  return (
    <CompositeRenderComponent
      getTree={getTree}
      path={path}
      slotProps={slotProps}
      cssHrefs={cssHrefs}
      jsPreloads={jsPreloads}
    />
  )
}

export type CompositeComponentProps<TComp extends AnyCompositeComponent> = {
  src: TComp
} & TComp['~types']['props']
