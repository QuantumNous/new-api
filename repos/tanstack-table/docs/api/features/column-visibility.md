---
title: Column Visibility APIs
id: column-visibility
---

## State

Column visibility state is stored on the table using the following shape:

```tsx
export type VisibilityState = Record<string, boolean>

export type VisibilityTableState = {
  columnVisibility: VisibilityState
}
```

## Column Def Options

### `enableHiding`

```tsx
enableHiding?: boolean
```

Enables/disables hiding the column

## Column API

### `getCanHide`

```tsx
getCanHide: () => boolean
```

Returns whether the column can be hidden

### `getIsVisible`

```tsx
getIsVisible: () => boolean
```

Returns whether the column is visible

### `toggleVisibility`

```tsx
toggleVisibility: (value?: boolean) => void
```

Toggles the column visibility

### `getToggleVisibilityHandler`

```tsx
getToggleVisibilityHandler: () => (event: unknown) => void
```

Returns a function that can be used to toggle the column visibility. This function can be used to bind to an event handler to a checkbox.

## Table Options

### `onColumnVisibilityChange`

```tsx
onColumnVisibilityChange?: OnChangeFn<VisibilityState>
```

If provided, this function will be called with an `updaterFn` when `state.columnVisibility` changes. This overrides the default internal state management, so you will need to persist the state change either fully or partially outside of the table.

### `enableHiding`

```tsx
enableHiding?: boolean
```

Enables/disables hiding of columns.

## Table API

### `getVisibleFlatColumns`

```tsx
getVisibleFlatColumns: () => Column<TData>[]
```

Returns a flat array of columns that are visible, including parent columns.

### `getVisibleLeafColumns`

```tsx
getVisibleLeafColumns: () => Column<TData>[]
```

Returns a flat array of leaf-node columns that are visible.

### `getLeftVisibleLeafColumns`

```tsx
getLeftVisibleLeafColumns: () => Column<TData>[]
```

If column pinning, returns a flat array of leaf-node columns that are visible in the left portion of the table.

### `getRightVisibleLeafColumns`

```tsx
getRightVisibleLeafColumns: () => Column<TData>[]
```

If column pinning, returns a flat array of leaf-node columns that are visible in the right portion of the table.

### `getCenterVisibleLeafColumns`

```tsx
getCenterVisibleLeafColumns: () => Column<TData>[]
```

If column pinning, returns a flat array of leaf-node columns that are visible in the unpinned/center portion of the table.

### `setColumnVisibility`

```tsx
setColumnVisibility: (updater: Updater<VisibilityState>) => void
```

Updates the column visibility state via an updater function or value

### `resetColumnVisibility`

```tsx
resetColumnVisibility: (defaultState?: boolean) => void
```

Resets the column visibility state to the initial state. If `defaultState` is provided, the state will be reset to `{}`

### `toggleAllColumnsVisible`

```tsx
toggleAllColumnsVisible: (value?: boolean) => void
```

Toggles the visibility of all columns

### `getIsAllColumnsVisible`

```tsx
getIsAllColumnsVisible: () => boolean
```

Returns whether all columns are visible

### `getIsSomeColumnsVisible`

```tsx
getIsSomeColumnsVisible: () => boolean
```

Returns whether some columns are visible

### `getToggleAllColumnsVisibilityHandler`

```tsx
getToggleAllColumnsVisibilityHandler: () => ((event: unknown) => void)
```

Returns a handler for toggling the visibility of all columns, meant to be bound to a `input[type=checkbox]` element.

## Row API

### `getVisibleCells`

```tsx
getVisibleCells: () => Cell<TData>[]
```

Returns an array of cells that account for column visibility for the row.