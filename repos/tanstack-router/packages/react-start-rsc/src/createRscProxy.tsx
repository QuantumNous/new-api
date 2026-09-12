'use client'

import { createElement } from 'react'
import { RscNodeRenderer } from './RscNodeRenderer'
import {
  RENDERABLE_RSC,
  RSC_PROXY_GET_TREE,
  RSC_PROXY_PATH,
  RSC_SLOT_USAGES,
  RSC_SLOT_USAGES_STREAM,
  SERVER_COMPONENT_CSS_HREFS,
  SERVER_COMPONENT_JS_PRELOADS,
  SERVER_COMPONENT_STREAM,
} from './ServerComponentTypes'
import type { RscSlotUsageEvent } from './ServerComponentTypes'

export interface RscProxyOptions {
  stream?: unknown // The stream to attach for serialization
  cssHrefs?: ReadonlySet<string> // CSS hrefs collected from the RSC stream
  jsPreloads?: ReadonlySet<string> // JS hrefs collected from the RSC stream
  renderable?: boolean // If true, proxy masquerades as React element
  slotUsagesStream?: ReadableStream<RscSlotUsageEvent> // Dev only: slot usage event stream
}

/**
 * Creates a recursive Proxy for RSC data.
 *
 * If `renderable: true`, returns a React element that can be rendered as `{data}`.
 * The element also has proxy-like behavior for nested access like `data.foo.bar`.
 *
 * If `renderable: false` (default), the proxy is NOT directly renderable and
 * must be used with `<CompositeComponent src={...} />`.
 */
export function createRscProxy<T>(
  getTree: () => T,
  options: RscProxyOptions = {},
): any {
  if (options.renderable) {
    // For renderable mode, create a real React element with proxy access
    return createRenderableElement(
      getTree,
      [],
      options.stream,
      options.cssHrefs,
      options.jsPreloads,
    )
  }
  let slotUsages: Array<RscSlotUsageEvent> | undefined = undefined

  if (
    process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' &&
    options.slotUsagesStream
  ) {
    slotUsages = []
    void consumeSlotUsages(options.slotUsagesStream, slotUsages)
  }

  // Non-renderable mode: plain proxy
  return createRscProxyWithPath(
    getTree,
    [],
    options.stream,
    options.cssHrefs,
    options.jsPreloads,
    slotUsages,
    options.slotUsagesStream,
  )
}

/**
 * Creates a React element that's also a Proxy for nested access.
 * This is used by renderable RSCs so they work as both {data} and {data.foo.bar}.
 */
type CreateProxyOptions = {
  getTree: () => unknown
  path: Array<string>
  stream: unknown | undefined
  cssHrefs: ReadonlySet<string> | undefined
  jsPreloads: ReadonlySet<string> | undefined
  renderable: boolean
  slotUsages: Array<RscSlotUsageEvent> | undefined
  slotUsagesStream: ReadableStream<RscSlotUsageEvent> | undefined
}

const UNHANDLED = Symbol('tanstack.rsc.proxy.unhandled')

function handleProxyTrap(
  kind: 'get' | 'has',
  prop: PropertyKey,
  options: CreateProxyOptions,
): unknown | boolean | typeof UNHANDLED {
  switch (prop) {
    // Seroval (>=1.5) uses string sentinels and `in` checks for internal types.
    // These proxies must never look like streams/sequences.
    case '__SEROVAL_STREAM__':
    case '__SEROVAL_SEQUENCE__':
      return kind === 'get' ? undefined : false

    // Seroval >=1.5 also checks iterability via `Symbol.iterator in value`.
    case Symbol.iterator:
    case Symbol.asyncIterator:
      return kind === 'get' ? undefined : false

    // Our proxy branding/properties
    case SERVER_COMPONENT_STREAM:
      return kind === 'get' ? options.stream : options.stream !== undefined
    case SERVER_COMPONENT_CSS_HREFS:
      return kind === 'get' ? options.cssHrefs : options.cssHrefs !== undefined
    case SERVER_COMPONENT_JS_PRELOADS:
      return kind === 'get'
        ? options.jsPreloads
        : options.jsPreloads !== undefined
    case RSC_PROXY_GET_TREE:
      return kind === 'get' ? options.getTree : true
    case RSC_PROXY_PATH:
      return kind === 'get' ? options.path : true
    case RENDERABLE_RSC:
      return kind === 'get' ? options.renderable : true
    case RSC_SLOT_USAGES:
      return kind === 'get'
        ? options.slotUsages
        : options.slotUsages !== undefined

    case RSC_SLOT_USAGES_STREAM:
      return kind === 'get'
        ? options.slotUsagesStream
        : options.slotUsagesStream !== undefined

    // Avoid promise-like checks
    case 'then':
      return kind === 'get' ? undefined : UNHANDLED

    // Avoid breaking primitive coercion (eg String(proxy)).
    // Without these, nested-selection proxies can shadow these keys and
    // cause `Cannot convert object to primitive value` errors.
    case 'toString':
      return kind === 'get' ? Object.prototype.toString : UNHANDLED
    case 'valueOf':
      return kind === 'get' ? Object.prototype.valueOf : UNHANDLED
    case 'constructor':
      return kind === 'get' ? Object : UNHANDLED
  }

  // Non-renderable proxies claim all string keys exist for nested selection,
  // but symbol presence checks should be accurate.
  if (typeof prop === 'symbol') {
    return kind === 'get' ? undefined : false
  }

  return UNHANDLED
}

function createRscProxyInternal(options: CreateProxyOptions): any {
  // Per-proxy cache so repeated property access is referentially stable.
  const childCache = new Map<string, any>()

  const getChild = (key: string) => {
    const cached = childCache.get(key)
    if (cached) return cached

    const next = createRscProxyInternal({
      ...options,
      path: [...options.path, key],
    })
    childCache.set(key, next)
    return next
  }

  const dataProxy = options.renderable
    ? createRscProxyInternal({ ...options, renderable: false })
    : undefined

  // Use a React element (renderable) or plain object (non-renderable) as Proxy target.
  const proxyTarget = options.renderable
    ? createElement(RscNodeRenderer, { data: dataProxy })
    : ({} as any)

  return new Proxy(proxyTarget, {
    get(target, prop) {
      const handled = handleProxyTrap('get', prop, options)
      if (handled !== UNHANDLED) return handled

      if (options.renderable) {
        // Proxy invariants: if target has a non-configurable, read-only property,
        // we must return the *exact* value for that property.
        if (prop === 'props') {
          return target.props
        }

        if (prop === 'data') {
          return dataProxy
        }

        if (prop in target) {
          return target[prop]
        }
      }

      return getChild(String(prop))
    },

    has(target, prop) {
      const handled = handleProxyTrap('has', prop, options)
      if (handled !== UNHANDLED) return handled as boolean

      if (options.renderable) {
        if (prop in target) return true
        if (typeof prop === 'string') return true
        return false
      }

      // Allow any property access for nested selection.
      return true
    },

    getPrototypeOf(target) {
      return options.renderable
        ? Object.getPrototypeOf(target)
        : Object.prototype
    },

    getOwnPropertyDescriptor(target, prop) {
      return options.renderable
        ? Object.getOwnPropertyDescriptor(target, prop)
        : undefined
    },

    ownKeys(target) {
      return options.renderable ? Reflect.ownKeys(target) : []
    },
  })
}

/**
 * Creates a React element that's also a Proxy for nested access.
 * This is used by renderable RSCs so they work as both {data} and {data.foo.bar}.
 */
function createRenderableElement(
  getTree: () => unknown,
  path: Array<string>,
  stream: unknown | undefined,
  cssHrefs: ReadonlySet<string> | undefined,
  jsPreloads: ReadonlySet<string> | undefined,
): any {
  return createRscProxyInternal({
    getTree,
    path,
    stream,
    cssHrefs,
    jsPreloads,
    renderable: true,
    slotUsages: undefined,
    slotUsagesStream: undefined,
  })
}

function createRscProxyWithPath(
  getTree: () => unknown,
  path: Array<string>,
  stream: unknown | undefined,
  cssHrefs: ReadonlySet<string> | undefined,
  jsPreloads: ReadonlySet<string> | undefined,
  slotUsages: Array<RscSlotUsageEvent> | undefined,
  slotUsagesStream: ReadableStream<RscSlotUsageEvent> | undefined,
): any {
  return createRscProxyInternal({
    getTree,
    path,
    stream,
    cssHrefs,
    jsPreloads,
    renderable: false,
    slotUsages,
    slotUsagesStream,
  })
}

async function consumeSlotUsages(
  stream: ReadableStream<RscSlotUsageEvent>,
  slotUsages: Array<RscSlotUsageEvent>,
): Promise<void> {
  try {
    const reader = stream.getReader()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value.slot) continue
      slotUsages.push(value)
    }
  } catch {
    // Ignore - dev-only best effort
  }
}
