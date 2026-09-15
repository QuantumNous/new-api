// /** @jsxImportSource solid-js */
import {
  TableOptions,
  createTable,
  TableOptionsResolved,
  RowData,
} from '@tanstack/table-core'
import { createComputed, mergeProps, createComponent } from 'solid-js'
import { createStore } from 'solid-js/store'

import type { JSX } from 'solid-js'
export * from '@tanstack/table-core'

export function flexRender<TProps>(
  Comp: ((props: TProps) => JSX.Element) | JSX.Element | undefined,
  props: TProps
): JSX.Element {
  if (!Comp) return null

  if (typeof Comp === 'function') {
    return createComponent(Comp, props)
  }

  return Comp
}

export function createSolidTable<TData extends RowData>(
  options: TableOptions<TData>
) {
  const resolvedOptions: TableOptionsResolved<TData> = mergeProps(
    {
      state: {}, // Dummy state
      onStateChange: () => {}, // noop
      renderFallbackValue: null,
      mergeOptions: (
        defaultOptions: TableOptions<TData>,
        options: Partial<TableOptions<TData>>
      ) => {
        return mergeProps(defaultOptions, options) as TableOptions<TData>
      },
    },
    options
  )

  const table = createTable<TData>(resolvedOptions)
  const [state, setState] = createStore(table.initialState)

  createComputed(() => {
    table.setOptions(prev => {
      return mergeProps(prev, options, {
        state: mergeProps(state, options.state || {}),
        // Similarly, we'll maintain both our internal state and any user-provided
        // state.
        onStateChange: (updater: any) => {
          // merging isn't required because stores shallow update
          setState(updater)

          options.onStateChange?.(updater)
        },
      })
    })
  })

  return table
}
