---
title: Expanding APIs
id: expanding
---

## State

Expanding state is stored on the table using the following shape:

```tsx
export type ExpandedState = true | Record<string, boolean>

export type ExpandedTableState = {
  expanded: ExpandedState
}
```

## Row API

### `toggleExpanded`

```tsx
toggleExpanded: (expanded?: boolean) => void
```

Toggles the expanded state (or sets it if `expanded` is provided) for the row.

### `getIsExpanded`

```tsx
getIsExpanded: () => boolean
```

Returns whether the row is expanded.

### `getIsAllParentsExpanded`

```tsx
getIsAllParentsExpanded: () => boolean
```

Returns whether all parent rows of the row are expanded.

### `getCanExpand`

```tsx
getCanExpand: () => boolean
```

Returns whether the row can be expanded.

### `getToggleExpandedHandler`

```tsx
getToggleExpandedHandler: () => () => void
```

Returns a function that can be used to toggle the expanded state of the row. This function can be used to bind to an event handler to a button.

## Table Options

### `manualExpanding`

```tsx
manualExpanding?: boolean
```

Enables manual row expansion. If this is set to `true`, `getExpandedRowModel` will not be used to expand rows and you would be expected to perform the expansion in your own data model. This is useful if you are doing server-side expansion.

### `onExpandedChange`

```tsx
onExpandedChange?: OnChangeFn<ExpandedState>
```

This function is called when the `expanded` table state changes. If a function is provided, you will be responsible for managing this state on your own. To pass the managed state back to the table, use the `tableOptions.state.expanded` option.

### `autoResetExpanded`

```tsx
autoResetExpanded?: boolean
```

Enable this setting to automatically reset the expanded state of the table when expanding state changes.

### `enableExpanding`

```tsx
enableExpanding?: boolean
```

Enable/disable expanding for all rows.

### `getExpandedRowModel`

```tsx
getExpandedRowModel?: (table: Table<TData>) => () => RowModel<TData>
```

This function is responsible for returning the expanded row model. If this function is not provided, the table will not expand rows. You can use the default exported `getExpandedRowModel` function to get the expanded row model or implement your own.

### `getIsRowExpanded`

```tsx
getIsRowExpanded?: (row: Row<TData>) => boolean
```

If provided, allows you to override the default behavior of determining whether a row is currently expanded.

### `getRowCanExpand`

```tsx
getRowCanExpand?: (row: Row<TData>) => boolean
```

If provided, allows you to override the default behavior of determining whether a row can be expanded.

### `paginateExpandedRows`

```tsx
paginateExpandedRows?: boolean
```

If `true` expanded rows will be paginated along with the rest of the table (which means expanded rows may span multiple pages).

If `false` expanded rows will not be considered for pagination (which means expanded rows will always render on their parents page. This also means more rows will be rendered than the set page size)

## Table API

### `setExpanded`

```tsx
setExpanded: (updater: Updater<ExpandedState>) => void
```

Updates the expanded state of the table via an update function or value

### `toggleAllRowsExpanded`

```tsx
toggleAllRowsExpanded: (expanded?: boolean) => void
```

Toggles the expanded state for all rows. Optionally, provide a value to set the expanded state to.

### `resetExpanded`

```tsx
resetExpanded: (defaultState?: boolean) => void
```

Reset the expanded state of the table to the initial state. If `defaultState` is provided, the expanded state will be reset to `{}`

### `getCanSomeRowsExpand`

```tsx
getCanSomeRowsExpand: () => boolean
```

Returns whether there are any rows that can be expanded.

### `getToggleAllRowsExpandedHandler`

```tsx
getToggleAllRowsExpandedHandler: () => (event: unknown) => void
```

Returns a handler that can be used to toggle the expanded state of all rows. This handler is meant to be used with an `input[type=checkbox]` element.

### `getIsSomeRowsExpanded`

```tsx
getIsSomeRowsExpanded: () => boolean
```

Returns whether there are any rows that are currently expanded.

### `getIsAllRowsExpanded`

```tsx
getIsAllRowsExpanded: () => boolean
```

Returns whether all rows are currently expanded.

### `getExpandedDepth`

```tsx
getExpandedDepth: () => number
```

Returns the maximum depth of the expanded rows.

### `getExpandedRowModel`

```tsx
getExpandedRowModel: () => RowModel<TData>
```

Returns the row model after expansion has been applied.

### `getPreExpandedRowModel`

```tsx
getPreExpandedRowModel: () => RowModel<TData>
```

Returns the row model before expansion has been applied.
