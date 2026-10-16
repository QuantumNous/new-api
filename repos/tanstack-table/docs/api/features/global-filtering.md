---
title: Global Filtering APIs
id: global-filtering
---

## Can-Filter

The ability for a column to be **globally** filtered is determined by the following:

- The column was defined a valid `accessorKey`/`accessorFn`.
- If provided, `options.getColumnCanGlobalFilter` returns `true` for the given column. If it is not provided, the column is assumed to be globally filterable if the value in the first row is a `string` or `number` type.
- `column.enableColumnFilter` is not set to `false`
- `options.enableColumnFilters` is not set to `false`
- `options.enableFilters` is not set to `false`

## State

Filter state is stored on the table using the following shape:

```tsx
export interface GlobalFilterTableState {
  globalFilter: any
}
```

## Filter Functions

You can use the same filter functions that are available for column filtering for global filtering. See the [Column Filtering APIs](../api/features/column-filtering) to learn more about filter functions.

#### Using Filter Functions

Filter functions can be used/referenced/defined by passing the following to `options.globalFilterFn`:

- A `string` that references a built-in filter function
- A function directly provided to the `options.globalFilterFn` option

The final list of filter functions available for the `tableOptions.globalFilterFn` options use the following type:

```tsx
export type FilterFnOption<TData extends AnyData> =
  | 'auto'
  | BuiltInFilterFn
  | FilterFn<TData>
```

#### Filter Meta

Filtering data can often expose additional information about the data that can be used to aid other future operations on the same data. A good example of this concept is a ranking-system like that of [`match-sorter`](https://github.com/kentcdodds/match-sorter) that simultaneously ranks, filters and sorts data. While utilities like `match-sorter` make a lot of sense for single-dimensional filter+sort tasks, the decoupled filtering/sorting architecture of building a table makes them very difficult and slow to use.

To make a ranking/filtering/sorting system work with tables, `filterFn`s can optionally mark results with a **filter meta** value that can be used later to sort/group/etc the data to your liking. This is done by calling the `addMeta` function supplied to your custom `filterFn`.

Below is an example using our own `match-sorter-utils` package (a utility fork of `match-sorter`) to rank, filter, and sort the data

```tsx
import { sortingFns } from '@tanstack/[adapter]-table'

import { rankItem, compareItems } from '@tanstack/match-sorter-utils'

const fuzzyFilter = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value)

  // Store the ranking info
  addMeta(itemRank)

  // Return if the item should be filtered in/out
  return itemRank.passed
}

const fuzzySort = (rowA, rowB, columnId) => {
  let dir = 0

  // Only sort by rank if the column has ranking information
  if (rowA.columnFiltersMeta[columnId]) {
    dir = compareItems(
      rowA.columnFiltersMeta[columnId]!,
      rowB.columnFiltersMeta[columnId]!
    )
  }

  // Provide an alphanumeric fallback for when the item ranks are equal
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir
}
```

## Column Def Options

### `enableGlobalFilter`

```tsx
enableGlobalFilter?: boolean
```

Enables/disables the **global** filter for this column.

## Column API

### `getCanGlobalFilter`

```tsx
getCanGlobalFilter: () => boolean
```

Returns whether or not the column can be **globally** filtered.  Set to `false` to disable a column from being scanned during global filtering.

## Row API

### `columnFiltersMeta`

```tsx
columnFiltersMeta: Record<string, any>
```

The column filters meta map for the row. This object tracks any filter meta for a row as optionally provided during the filtering process.

## Table Options

### `filterFns`

```tsx
filterFns?: Record<string, FilterFn>
```

This option allows you to define custom filter functions that can be referenced in a column's `filterFn` option by their key.
Example:

```tsx
declare module '@tanstack/table-core' {
  interface FilterFns {
    myCustomFilter: FilterFn<unknown>
  }
}

const column = columnHelper.data('key', {
  filterFn: 'myCustomFilter',
})

const table = useReactTable({
  columns: [column],
  filterFns: {
    myCustomFilter: (rows, columnIds, filterValue) => {
      // return the filtered rows
    },
  },
})
```

### `filterFromLeafRows`

```tsx
filterFromLeafRows?: boolean
```

By default, filtering is done from parent rows down (so if a parent row is filtered out, all of its children will be filtered out as well). Setting this option to `true` will cause filtering to be done from leaf rows up (which means parent rows will be included so long as one of their child or grand-child rows is also included).

### `maxLeafRowFilterDepth`

```tsx
maxLeafRowFilterDepth?: number
```

By default, filtering is done for all rows (max depth of 100), no matter if they are root level parent rows or the child leaf rows of a parent row. Setting this option to `0` will cause filtering to only be applied to the root level parent rows, with all sub-rows remaining unfiltered. Similarly, setting this option to `1` will cause filtering to only be applied to child leaf rows 1 level deep, and so on.

This is useful for situations where you want a row's entire child hierarchy to be visible regardless of the applied filter.

### `enableFilters`

```tsx
enableFilters?: boolean
```

Enables/disables all filters for the table.

### `manualFiltering`

```tsx
manualFiltering?: boolean
```

Disables the `getFilteredRowModel` from being used to filter data. This may be useful if your table needs to dynamically support both client-side and server-side filtering.

### `getFilteredRowModel`

```tsx
getFilteredRowModel?: (
  table: Table<TData>
) => () => RowModel<TData>
```

If provided, this function is called **once** per table and should return a **new function** which will calculate and return the row model for the table when it's filtered.

- For server-side filtering, this function is unnecessary and can be ignored since the server should already return the filtered row model.
- For client-side filtering, this function is required. A default implementation is provided via any table adapter's `{ getFilteredRowModel }` export.

Example:

```tsx
import { getFilteredRowModel } from '@tanstack/[adapter]-table'

  getFilteredRowModel: getFilteredRowModel(),
})
```

### `globalFilterFn`

```tsx
globalFilterFn?: FilterFn | keyof FilterFns | keyof BuiltInFilterFns
```

The filter function to use for global filtering.

Options:

- A `string` referencing a [built-in filter function](#filter-functions))
- A `string` that references a custom filter functions provided via the `tableOptions.filterFns` option
- A [custom filter function](#filter-functions)

### `onGlobalFilterChange`

```tsx
onGlobalFilterChange?: OnChangeFn<GlobalFilterState>
```

If provided, this function will be called with an `updaterFn` when `state.globalFilter` changes. This overrides the default internal state management, so you will need to persist the state change either fully or partially outside of the table.

### `enableGlobalFilter`

```tsx
enableGlobalFilter?: boolean
```

Enables/disables the global filter for the table.

### `getColumnCanGlobalFilter`

```tsx
getColumnCanGlobalFilter?: (column: Column<TData>) => boolean
```

If provided, this function will be called with the column and should return `true` or `false` to indicate whether this column should be used for global filtering.
This is useful if the column can contain data that is not `string` or `number` (i.e. `undefined`).

## Table API

### `getPreFilteredRowModel`

```tsx
getPreFilteredRowModel: () => RowModel<TData>
```

Returns the row model for the table before any **column** filtering has been applied.

### `getFilteredRowModel`

```tsx
getFilteredRowModel: () => RowModel<TData>
```

Returns the row model for the table after **column** filtering has been applied.

### `setGlobalFilter`

```tsx
setGlobalFilter: (updater: Updater<any>) => void
```

Sets or updates the `state.globalFilter` state.

### `resetGlobalFilter`

```tsx
resetGlobalFilter: (defaultState?: boolean) => void
```

Resets the **globalFilter** state to `initialState.globalFilter`, or `true` can be passed to force a default blank state reset to `undefined`.

### `getGlobalAutoFilterFn`

```tsx
getGlobalAutoFilterFn: (columnId: string) => FilterFn<TData> | undefined
```

Currently, this function returns the built-in `includesString` filter function. In future releases, it may return more dynamic filter functions based on the nature of the data provided.

### `getGlobalFilterFn`

```tsx
getGlobalFilterFn: (columnId: string) => FilterFn<TData> | undefined
```

Returns the global filter function (either user-defined or automatic, depending on configuration) for the table.
