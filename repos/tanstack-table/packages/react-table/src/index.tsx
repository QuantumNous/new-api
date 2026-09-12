import * as React from 'react'
export * from '@tanstack/table-core'

import {
  TableOptions,
  TableOptionsResolved,
  RowData,
  createTable,
} from '@tanstack/table-core'

export type Renderable<TProps> = React.ReactNode | React.ComponentType<TProps>

//

/**
 * If rendering headers, cells, or footers with custom markup, use flexRender instead of `cell.getValue()` or `cell.renderValue()`.
 */
export function flexRender<TProps extends object>(
  Comp: Renderable<TProps>,
  props: TProps
): React.ReactNode | React.JSX.Element {
  return !Comp ? null : isReactComponent<TProps>(Comp) ? (
    <Comp {...props} />
  ) : (
    Comp
  )
}

function isReactComponent<TProps>(
  component: unknown
): component is React.ComponentType<TProps> {
  return (
    isClassComponent(component) ||
    typeof component === 'function' ||
    isExoticComponent(component)
  )
}

function isClassComponent(component: any) {
  return (
    typeof component === 'function' &&
    (() => {
      const proto = Object.getPrototypeOf(component)
      return proto.prototype && proto.prototype.isReactComponent
    })()
  )
}

function isExoticComponent(component: any) {
  return (
    typeof component === 'object' &&
    typeof component.$$typeof === 'symbol' &&
    ['react.memo', 'react.forward_ref'].includes(component.$$typeof.description)
  )
}

export function useReactTable<TData extends RowData>(
  options: TableOptions<TData>
) {
  // Compose in the generic options to the user options
  const resolvedOptions: TableOptionsResolved<TData> = {
    state: {}, // Dummy state
    onStateChange: () => {}, // noop
    renderFallbackValue: null,
    ...options,
  }

  // Create a new table and store it in state
  const [tableRef] = React.useState(() => ({
    current: createTable<TData>(resolvedOptions),
  }))

  // By default, manage table state here using the table's initial state
  const [state, setState] = React.useState(() => tableRef.current.initialState)

  // Compose the default state above with any user state. This will allow the user
  // to only control a subset of the state if desired.
  tableRef.current.setOptions(prev => ({
    ...prev,
    ...options,
    state: {
      ...state,
      ...options.state,
    },
    // Similarly, we'll maintain both our internal state and any user-provided
    // state.
    onStateChange: updater => {
      setState(updater)
      options.onStateChange?.(updater)
    },
  }))

  return tableRef.current
}
