import { Dynamic } from 'solid-js/web'
import { createEffect, createRenderEffect, createSignal } from 'solid-js'
import { useTheme } from './theme'
import useMediaQuery from './useMediaQuery'
import type { AnyRoute, AnyRouteMatch } from '@tanstack/router-core'

import type { Theme } from './theme'
import type { JSX } from 'solid-js'

export const isServer = typeof window === 'undefined'

type StyledComponent<T> = T extends 'button'
  ? JSX.ButtonHTMLAttributes<HTMLButtonElement>
  : T extends 'input'
    ? JSX.InputHTMLAttributes<HTMLInputElement>
    : T extends 'select'
      ? JSX.SelectHTMLAttributes<HTMLSelectElement>
      : T extends keyof HTMLElementTagNameMap
        ? JSX.HTMLAttributes<HTMLElementTagNameMap[T]>
        : never

export function getStatusColor(match: AnyRouteMatch) {
  const colorMap = {
    pending: 'yellow',
    success: 'green',
    error: 'red',
    notFound: 'purple',
    redirected: 'gray',
  } as const

  return match.isFetching && match.status === 'success'
    ? match.isFetching === 'beforeLoad'
      ? 'purple'
      : 'blue'
    : colorMap[match.status]
}

export function getRouteStatusColor(
  matches: Array<AnyRouteMatch>,
  route: AnyRoute,
) {
  const found = matches.find((d) => d.routeId === route.id)
  if (!found) return 'gray'
  return getStatusColor(found)
}

type Styles =
  | JSX.CSSProperties
  | ((props: Record<string, any>, theme: Theme) => JSX.CSSProperties)

export function styled<T extends keyof HTMLElementTagNameMap>(
  type: T,
  newStyles: Styles,
  queries: Record<string, Styles> = {},
) {
  return ({
    ref,
    style,
    ...rest
  }: StyledComponent<T> & {
    ref?: HTMLElementTagNameMap[T] | undefined
  }) => {
    const theme = useTheme()

    const mediaStyles = Object.entries(queries).reduce(
      (current, [key, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return useMediaQuery(key)
          ? {
              ...current,
              ...(typeof value === 'function' ? value(rest, theme) : value),
            }
          : current
      },
      {},
    )

    const baseStyles =
      typeof newStyles === 'function' ? newStyles(rest, theme) : newStyles

    // Handle style being either a string or an object
    const combinedStyles =
      typeof style === 'string'
        ? { ...baseStyles, ...mediaStyles, cssText: style }
        : { ...baseStyles, ...style, ...mediaStyles }

    return (
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      <Dynamic component={type} {...rest} style={combinedStyles} ref={ref} />
    )
  }
}

export function useIsMounted() {
  const [isMounted, setIsMounted] = createSignal(false)

  const effect = isServer ? createEffect : createRenderEffect

  effect(() => {
    setIsMounted(true)
  })

  return isMounted
}

// Symbols for RSC detection
const SERVER_COMPONENT_STREAM = Symbol.for('tanstack.rsc.stream')
const RENDERABLE_RSC = Symbol.for('tanstack.rsc.renderable')
const RSC_SLOT_USAGES = Symbol.for('tanstack.rsc.slotUsages')

export type RscSlotUsageEvent = {
  slot: string
  args?: Array<any>
}

function trimTrailingUndefined<T>(arr: Array<T>): Array<T> {
  let end = arr.length
  while (end > 0 && arr[end - 1] === undefined) end--
  if (end === 0) return arr
  return end === arr.length ? arr : arr.slice(0, end)
}

export type ServerComponentType =
  | 'compositeSource' // createCompositeComponent result (render via <CompositeComponent src={...} />)
  | 'renderableValue' // renderServerComponent result (inline renderable value)
  | null // not a server component

/**
 * Checks if a value is any kind of server component
 */
export const isServerComponent = (value: unknown): boolean => {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    SERVER_COMPONENT_STREAM in value
  )
}

/**
 * Gets the type of server component.
 * - RENDERABLE_RSC === true → renderable (from renderServerComponent)
 * - RENDERABLE_RSC === false or not present → composite (from createCompositeComponent)
 */
export const getServerComponentType = (value: unknown): ServerComponentType => {
  if (!isServerComponent(value)) {
    return null
  }
  const v = value as Record<symbol, unknown>
  if (RENDERABLE_RSC in v && v[RENDERABLE_RSC] === true) {
    return 'renderableValue'
  }
  // RENDERABLE_RSC is false or not present → composite
  return 'compositeSource'
}

/**
 * Gets the slot names from a composite server component (dev only)
 */
export const getServerComponentSlots = (value: unknown): Array<string> => {
  if (!isServerComponent(value)) {
    return []
  }

  const v = value as Record<symbol, unknown>
  const out: Array<string> = []
  // Include any slot names observed via dev-only slot usage events
  if (RSC_SLOT_USAGES in v) {
    const usages = v[RSC_SLOT_USAGES]
    if (Array.isArray(usages)) {
      for (const evt of usages) {
        const name = evt?.slot
        if (typeof name === 'string' && !out.includes(name)) {
          out.push(name)
        }
      }
    }
  }

  return out
}

export const getServerComponentSlotUsages = (
  value: unknown,
): Array<RscSlotUsageEvent> => {
  if (!isServerComponent(value)) {
    return []
  }

  const v = value as Record<symbol, unknown>
  if (!(RSC_SLOT_USAGES in v)) return []
  const usages = v[RSC_SLOT_USAGES]
  if (!Array.isArray(usages)) return []

  return usages.filter((d): d is RscSlotUsageEvent => {
    return (
      d &&
      typeof d === 'object' &&
      typeof d.slot === 'string' &&
      (d.args === undefined || Array.isArray(d.args))
    )
  })
}

export const getServerComponentSlotUsageSummary = (
  value: unknown,
): Record<string, { count: number; invocations: Array<Array<any>> }> => {
  const usages = getServerComponentSlotUsages(value)
  const out: Record<string, { count: number; invocations: Array<Array<any>> }> =
    {}
  for (const evt of usages) {
    const args = trimTrailingUndefined(evt.args ?? [])
    const prev =
      out[evt.slot] ?? (out[evt.slot] = { count: 0, invocations: [] })
    prev.count++
    prev.invocations.push(args)
  }
  return out
}

/**
 * Displays a string regardless the type of the data
 * @param {unknown} value Value to be stringified
 */
export const displayValue = (value: unknown) => {
  if (value === 'React element') return 'React element'
  const componentType = getServerComponentType(value)
  if (componentType === 'compositeSource') {
    const slots = getServerComponentSlots(value)
    if (slots.length > 0) {
      return `RSC composite source (${slots.length} ${
        slots.length === 1 ? 'slot' : 'slots'
      })`
    }
    return 'RSC composite source'
  }
  if (componentType === 'renderableValue') {
    return 'RSC renderable value'
  }
  const name = Object.getOwnPropertyNames(Object(value))
  const newValue = typeof value === 'bigint' ? `${value.toString()}n` : value
  try {
    return JSON.stringify(newValue, name)
  } catch {
    return `unable to stringify`
  }
}

/**
 * This hook is a safe useState version which schedules state updates in microtasks
 * to prevent updating a component state while React is rendering different components
 * or when the component is not mounted anymore.
 */
export function useSafeState<T>(initialState: T): [T, (value: T) => void] {
  const isMounted = useIsMounted()
  const [state, setState] = createSignal(initialState)

  const safeSetState = (value: T) => {
    scheduleMicrotask(() => {
      if (isMounted()) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        setState(value)
      }
    })
  }

  return [state(), safeSetState]
}

/**
 * Schedules a microtask.
 * This can be useful to schedule state updates after rendering.
 */
function scheduleMicrotask(callback: () => void) {
  Promise.resolve()
    .then(callback)
    .catch((error) =>
      setTimeout(() => {
        throw error
      }),
    )
}

export function multiSortBy<T>(
  arr: Array<T>,
  accessors: Array<(item: T) => any> = [(d) => d],
): Array<T> {
  return arr
    .map((d, i) => [d, i] as const)
    .sort(([a, ai], [b, bi]) => {
      for (const accessor of accessors) {
        const ao = accessor(a)
        const bo = accessor(b)

        if (typeof ao === 'undefined') {
          if (typeof bo === 'undefined') {
            continue
          }
          return 1
        }

        if (ao === bo) {
          continue
        }

        return ao > bo ? 1 : -1
      }

      return ai - bi
    })
    .map(([d]) => d)
}
