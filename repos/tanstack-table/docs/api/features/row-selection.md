---
title: Row Selection APIs
id: row-selection
---

## State

Row selection state is stored on the table using the following shape:

```tsx
export type RowSelectionState = Record<string, boolean>

export type RowSelectionTableState = {
  rowSelection: RowSelectionState
}
```

By default, the row selection state uses the index of each row as the row identifiers. Row selection state can instead be tracked with a custom unique row id by passing in a custom [getRowId](../core/table.md#getrowid) function to the the table.

## Table Options

### `enableRowSelection`

```tsx
enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
```

- Enables/disables row selection for all rows in the table OR
- A function that given a row, returns whether to enable/disable row selection for that row

### `enableMultiRowSelection`

```tsx
enableMultiRowSelection?: boolean | ((row: Row<TData>) => boolean)
```

- Enables/disables multiple row selection for all rows in the table OR
- A function that given a row, returns whether to enable/disable multiple row selection for that row's children/grandchildren

### `enableSubRowSelection`

```tsx
enableSubRowSelection?: boolean | ((row: Row<TData>) => boolean)
```

Enables/disables automatic sub-row selection when a parent row is selected, or a function that enables/disables automatic sub-row selection for each row.

(Use in combination with expanding or grouping features)

### `onRowSelectionChange`

```tsx
onRowSelectionChange?: OnChangeFn<RowSelectionState>
```

If provided, this function will be called with an `updaterFn` when `state.rowSelection` changes. This overrides the default internal state management, so you will need to persist the state change either fully or partially outside of the table.

## Table API

### `getToggleAllRowsSelectedHandler`

```tsx
getToggleAllRowsSelectedHandler: () => (event: unknown) => void
```

Returns a handler that can be used to toggle all rows in the table.

### `getToggleAllPageRowsSelectedHandler`

```tsx
getToggleAllPageRowsSelectedHandler: () => (event: unknown) => void
```

Returns a handler that can be used to toggle all rows on the current page.

### `setRowSelection`

```tsx
setRowSelection: (updater: Updater<RowSelectionState>) => void
```

Sets or updates the `state.rowSelection` state.

### `resetRowSelection`

```tsx
resetRowSelection: (defaultState?: boolean) => void
```

Resets the **rowSelection** state to the `initialState.rowSelection`, or `true` can be passed to force a default blank state reset to `{}`.

### `getIsAllRowsSelected`

```tsx
getIsAllRowsSelected: () => boolean
```

Returns whether or not all rows in the table are selected.

### `getIsAllPageRowsSelected`

```tsx
getIsAllPageRowsSelected: () => boolean
```

Returns whether or not all rows on the current page are selected.

### `getIsSomeRowsSelected`

```tsx
getIsSomeRowsSelected: () => boolean
```

Returns whether or not any rows in the table are selected.

NOTE: Returns `false` if all rows are selected.

### `getIsSomePageRowsSelected`

```tsx
getIsSomePageRowsSelected: () => boolean
```

Returns whether or not any rows on the current page are selected.

### `toggleAllRowsSelected`

```tsx
toggleAllRowsSelected: (value: boolean) => void
```

Selects/deselects all rows in the table.

### `toggleAllPageRowsSelected`

```tsx
toggleAllPageRowsSelected: (value: boolean) => void
```

Selects/deselects all rows on the current page.

### `getPreSelectedRowModel`

```tsx
getPreSelectedRowModel: () => RowModel<TData>
```

### `getSelectedRowModel`

```tsx
getSelectedRowModel: () => RowModel<TData>
```

### `getFilteredSelectedRowModel`

```tsx
getFilteredSelectedRowModel: () => RowModel<TData>
```

### `getGroupedSelectedRowModel`

```tsx
getGroupedSelectedRowModel: () => RowModel<TData>
```

## Row API

### `getIsSelected`

```tsx
getIsSelected: () => boolean
```

Returns whether or not the row is selected.

### `getIsSomeSelected`

```tsx
getIsSomeSelected: () => boolean
```

Returns whether or not some of the row's sub rows are selected.

### `getIsAllSubRowsSelected`

```tsx
getIsAllSubRowsSelected: () => boolean
```

Returns whether or not all of the row's sub rows are selected.

### `getCanSelect`

```tsx
getCanSelect: () => boolean
```

Returns whether or not the row can be selected.

### `getCanMultiSelect`

```tsx
getCanMultiSelect: () => boolean
```

Returns whether or not the row can multi-select.

### `getCanSelectSubRows`

```tsx
getCanSelectSubRows: () => boolean
```

Returns whether or not the row can select sub rows automatically when the parent row is selected.

### `toggleSelected`

```tsx
toggleSelected: (value?: boolean) => void
```

Selects/deselects the row.

### `getToggleSelectedHandler`

```tsx
getToggleSelectedHandler: () => (event: unknown) => void
```

Returns a handler that can be used to toggle the row.
