---
title: Pagination APIs
id: pagination
---

## State

Pagination state is stored on the table using the following shape:

```tsx
export type PaginationState = {
  pageIndex: number
  pageSize: number
}

export type PaginationTableState = {
  pagination: PaginationState
}

export type PaginationInitialTableState = {
  pagination?: Partial<PaginationState>
}
```

## Table Options

### `manualPagination`

```tsx
manualPagination?: boolean
```

Enables manual pagination. If this option is set to `true`, the table will not automatically paginate rows using `getPaginationRowModel()` and instead will expect you to manually paginate the rows before passing them to the table. This is useful if you are doing server-side pagination and aggregation.

### `pageCount`

```tsx
pageCount?: number
```

When manually controlling pagination, you can supply a total `pageCount` value to the table if you know it. If you do not know how many pages there are, you can set this to `-1`. Alternatively, you can provide a `rowCount` value and the table will calculate the `pageCount` internally.

### `rowCount`

```tsx
rowCount?: number
```

When manually controlling pagination, you can supply a total `rowCount` value to the table if you know it. `pageCount` will be calculated internally from `rowCount` and `pageSize`.

### `autoResetPageIndex`

```tsx
autoResetPageIndex?: boolean
```

If set to `true`, pagination will be reset to the first page when page-altering state changes eg. `data` is updated, filters change, grouping changes, etc.

> 🧠 Note: This option defaults to `false` if `manualPagination` is set to `true`

### `onPaginationChange`

```tsx
onPaginationChange?: OnChangeFn<PaginationState>
```

If this function is provided, it will be called when the pagination state changes and you will be expected to manage the state yourself. You can pass the managed state back to the table via the `tableOptions.state.pagination` option.

### `getPaginationRowModel`

```tsx
getPaginationRowModel?: (table: Table<TData>) => () => RowModel<TData>
```

Returns the row model after pagination has taken place, but no further.

Pagination columns are automatically reordered by default to the start of the columns list. If you would rather remove them or leave them as-is, set the appropriate mode here.

## Table API

### `setPagination`

```tsx
setPagination: (updater: Updater<PaginationState>) => void
```

Sets or updates the `state.pagination` state.

### `resetPagination`

```tsx
resetPagination: (defaultState?: boolean) => void
```

Resets the **pagination** state to `initialState.pagination`, or `true` can be passed to force a default blank state reset to `[]`.

### `setPageIndex`

```tsx
setPageIndex: (updater: Updater<number>) => void
```

Updates the page index using the provided function or value.

### `resetPageIndex`

```tsx
resetPageIndex: (defaultState?: boolean) => void
```

Resets the page index to its initial state. If `defaultState` is `true`, the page index will be reset to `0` regardless of initial state.

### `setPageSize`

```tsx
setPageSize: (updater: Updater<number>) => void
```

Updates the page size using the provided function or value.

### `resetPageSize`

```tsx
resetPageSize: (defaultState?: boolean) => void
```

Resets the page size to its initial state. If `defaultState` is `true`, the page size will be reset to `10` regardless of initial state.

### `getPageOptions`

```tsx
getPageOptions: () => number[]
```

Returns an array of page options (zero-index-based) for the current page size.

### `getCanPreviousPage`

```tsx
getCanPreviousPage: () => boolean
```

Returns whether the table can go to the previous page.

### `getCanNextPage`

```tsx
getCanNextPage: () => boolean
```

Returns whether the table can go to the next page.

### `previousPage`

```tsx
previousPage: () => void
```

Decrements the page index by one, if possible.

### `nextPage`

```tsx
nextPage: () => void
```

Increments the page index by one, if possible.

### `firstPage`

```tsx
firstPage: () => void
```

Sets the page index to `0`.

### `lastPage`

```tsx
lastPage: () => void
```

Sets the page index to the last available page.

### `getPageCount`

```tsx
getPageCount: () => number
```

Returns the page count. If manually paginating or controlling the pagination state, this will come directly from the `options.pageCount` table option, otherwise it will be calculated from the table data using the total row count and current page size.

### `getPrePaginationRowModel`

```tsx
getPrePaginationRowModel: () => RowModel<TData>
```

Returns the row model for the table before any pagination has been applied.

### `getPaginationRowModel`

```tsx
getPaginationRowModel: () => RowModel<TData>
```

Returns the row model for the table after pagination has been applied.
