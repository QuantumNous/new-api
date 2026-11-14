import { Column, Table } from '@tanstack/solid-table'
import { debounce } from '@solid-primitives/scheduled'
import { createMemo, For, Show } from 'solid-js'

function ColumnFilter(props: {
  column: Column<any, unknown>
  table: Table<any>
}) {
  const firstValue = props.table
    .getPreFilteredRowModel()
    .flatRows[0]?.getValue(props.column.id)

  const columnFilterValue = () => props.column.getFilterValue()

  const sortedUniqueValues = createMemo(() =>
    typeof firstValue === 'number'
      ? []
      : Array.from(props.column.getFacetedUniqueValues().keys()).sort()
  )

  return (
    <Show
      when={typeof firstValue === 'number'}
      fallback={
        <div>
          <datalist id={`${props.column.id}list`}>
            <For each={sortedUniqueValues().slice(0, 5000)}>
              {(value: string) => <option value={value} />}
            </For>
          </datalist>
          <input
            type="text"
            value={(columnFilterValue() ?? '') as string}
            onInput={debounce(
              e => props.column.setFilterValue(e.target.value),
              500
            )}
            placeholder={`Search... (${props.column.getFacetedUniqueValues().size})`}
            class="w-36 border shadow rounded"
            list={`${props.column.id}list`}
          />
        </div>
      }
    >
      <div>
        <div class="flex space-x-2">
          <input
            type="number"
            min={Number(props.column.getFacetedMinMaxValues()?.[0] ?? '')}
            max={Number(props.column.getFacetedMinMaxValues()?.[1] ?? '')}
            value={(columnFilterValue() as [number, number])?.[0] ?? ''}
            onInput={debounce(
              e =>
                props.column.setFilterValue((old: [number, number]) => [
                  e.target.value,
                  old?.[1],
                ]),
              500
            )}
            placeholder={`Min ${
              props.column.getFacetedMinMaxValues()?.[0]
                ? `(${props.column.getFacetedMinMaxValues()?.[0]})`
                : ''
            }`}
            class="w-24 border shadow rounded"
          />
          <input
            type="number"
            min={Number(props.column.getFacetedMinMaxValues()?.[0] ?? '')}
            max={Number(props.column.getFacetedMinMaxValues()?.[1] ?? '')}
            value={(columnFilterValue() as [number, number])?.[1] ?? ''}
            onInput={debounce(
              e =>
                props.column.setFilterValue((old: [number, number]) => [
                  old?.[0],
                  e.target.value,
                ]),
              500
            )}
            placeholder={`Max ${
              props.column.getFacetedMinMaxValues()?.[1]
                ? `(${props.column.getFacetedMinMaxValues()?.[1]})`
                : ''
            }`}
            class="w-24 border shadow rounded"
          />
        </div>
      </div>
    </Show>
  )
}

export default ColumnFilter
