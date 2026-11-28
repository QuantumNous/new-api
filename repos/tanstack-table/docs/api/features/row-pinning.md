---
title: Row Pinning APIs
id: row-pinning
---

## Can-Pin

The ability for a row to be **pinned** is determined by the following:

- `options.enableRowPinning` resolves to `true`
- `options.enablePinning` is not set to `false`

## State

Pinning state is stored on the table using the following shape:

```tsx
export type RowPinningPosition = false | 'top' | 'bottom'

export type RowPinningState = {
  top?: string[]
  bottom?: string[]
}

export type RowPinningRowState = {
  rowPinning: RowPinningState
}
```

## Table Options

### `enableRowPinning`

```tsx
enableRowPinning?: boolean | ((row: Row<TData>) => boolean)
```

Enables/disables row pinning for all rows in the table.

### `keepPinnedRows`

```tsx
keepPinnedRows?: boolean
```

When `false`, pinned rows will not be visible if they are filtered or paginated out of the table. When `true`, pinned rows will always be visible regardless of filtering or pagination. Defaults to `true`.

### `onRowPinningChange`

```tsx
onRowPinningChange?: OnChangeFn<RowPinningState>
```

If provided, this function will be called with an `updaterFn` when `state.rowPinning` changes. This overrides the default internal state management, so you will also need to supply `state.rowPinning` from your own managed state.

## Table API

### `setRowPinning`

```tsx
setRowPinning: (updater: Updater<RowPinningState>) => void
```

Sets or updates the `state.rowPinning` state.

### `resetRowPinning`

```tsx
resetRowPinning: (defaultState?: boolean) => void
```

Resets the **rowPinning** state to `initialState.rowPinning`, or `true` can be passed to force a default blank state reset to `{}`.

### `getIsSomeRowsPinned`

```tsx
getIsSomeRowsPinned: (position?: RowPinningPosition) => boolean
```

Returns whether or not any rows are pinned. Optionally specify to only check for pinned rows in either the `top` or `bottom` position.

### `getTopRows`

```tsx
getTopRows: () => Row<TData>[]
```

Returns all top pinned rows.

### `getBottomRows`

```tsx
getBottomRows: () => Row<TData>[]
```

Returns all bottom pinned rows.

### `getCenterRows`

```tsx
getCenterRows: () => Row<TData>[]
```

Returns all rows that are not pinned to the top or bottom.

## Row API

### `pin`

```tsx
pin: (position: RowPinningPosition) => void
```

Pins a row to the `'top'` or `'bottom'`, or unpins the row to the center if `false` is passed.

### `getCanPin`

```tsx
getCanPin: () => boolean
```

Returns whether or not the row can be pinned.

### `getIsPinned`

```tsx
getIsPinned: () => RowPinningPosition
```

Returns the pinned position of the row. (`'top'`, `'bottom'` or `false`)

### `getPinnedIndex`

```tsx
getPinnedIndex: () => number
```

Returns the numeric pinned index of the row within a pinned row group.