import { computed, type Signal, signal } from '@angular/core'
import {
  RowData,
  TableOptions,
  TableOptionsResolved,
  TableState,
  createTable,
  type Table,
} from '@tanstack/table-core'
import { lazyInit } from './lazy-signal-initializer'
import { proxifyTable } from './proxy'

export * from '@tanstack/table-core'

export {
  type FlexRenderContent,
  FlexRenderDirective,
  FlexRenderDirective as FlexRender,
  injectFlexRenderContext,
  type FlexRenderComponentProps,
} from './flex-render'

export {
  FlexRenderComponent,
  flexRenderComponent,
} from './flex-render/flex-render-component'

export function createAngularTable<TData extends RowData>(
  options: () => TableOptions<TData>
): Table<TData> & Signal<Table<TData>> {
  return lazyInit(() => {
    const resolvedOptions = {
      state: {},
      onStateChange: () => {},
      renderFallbackValue: null,
      ...options(),
    }

    const table = createTable(resolvedOptions)

    // By default, manage table state here using the table's initial state
    const state = signal<TableState>(table.initialState)

    // Compose table options using computed.
    // This is to allow `tableSignal` to listen and set table option
    const updatedOptions = computed<TableOptionsResolved<TData>>(() => {
      // listen to table state changed
      const tableState = state()
      // listen to input options changed
      const tableOptions = options()
      return {
        ...table.options,
        ...resolvedOptions,
        ...tableOptions,
        state: { ...tableState, ...tableOptions.state },
        onStateChange: updater => {
          const value =
            updater instanceof Function ? updater(tableState) : updater
          state.set(value)
          resolvedOptions.onStateChange?.(updater)
        },
      }
    })

    // convert table instance to signal for proxify to listen to any table state and options changes
    const tableSignal = computed(
      () => {
        table.setOptions(updatedOptions())
        return table
      },
      {
        equal: () => false,
      }
    )

    // proxify Table instance to provide ability for consumer to listen to any table state changes
    return proxifyTable(tableSignal)
  })
}
