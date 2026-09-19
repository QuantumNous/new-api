---
title: Column Sizing APIs
id: column-sizing
---

## State

Column sizing state is stored on the table using the following shape:

```tsx
export type ColumnSizingTableState = {
  columnSizing: ColumnSizing
  columnSizingInfo: ColumnSizingInfoState
}

export type ColumnSizing = Record<string, number>

export type ColumnSizingInfoState = {
  startOffset: null | number
  startSize: null | number
  deltaOffset: null | number
  deltaPercentage: null | number
  isResizingColumn: false | string
  columnSizingStart: [string, number][]
}
```

## Column Def Options

### `enableResizing`

```tsx
enableResizing?: boolean
```

Enables or disables column resizing for the column.

### `size`

```tsx
size?: number
```

The desired size for the column

### `minSize`

```tsx
minSize?: number
```

The minimum allowed size for the column

### `maxSize`

```tsx
maxSize?: number
```

The maximum allowed size for the column

## Column API

### `getSize`

```tsx
getSize: () => number
```

Returns the current size of the column

### `getStart`

```tsx
getStart: (position?: ColumnPinningPosition) => number
```

Returns the offset measurement along the row-axis (usually the x-axis for standard tables) for the column, measuring the size of all preceding columns.

Useful for sticky or absolute positioning of columns. (e.g. `left` or `transform`)

### `getAfter`

```tsx
getAfter: (position?: ColumnPinningPosition) => number
```

Returns the offset measurement along the row-axis (usually the x-axis for standard tables) for the column, measuring the size of all succeeding columns.

Useful for sticky or absolute positioning of columns. (e.g. `right` or `transform`)

### `getCanResize`

```tsx
getCanResize: () => boolean
```

Returns `true` if the column can be resized.

### `getIsResizing`

```tsx
getIsResizing: () => boolean
```

Returns `true` if the column is currently being resized.

### `resetSize`

```tsx
resetSize: () => void
```

Resets the column size to its initial size.

## Header API

### `getSize`

```tsx
getSize: () => number
```

Returns the size for the header, calculated by summing the size of all leaf-columns that belong to it.

### `getStart`

```tsx
getStart: (position?: ColumnPinningPosition) => number
```

Returns the offset measurement along the row-axis (usually the x-axis for standard tables) for the header. This is effectively a sum of the offset measurements of all preceding headers.

### `getResizeHandler`

```tsx
getResizeHandler: () => (event: unknown) => void
```

Returns an event handler function that can be used to resize the header. It can be used as an:

- `onMouseDown` handler
- `onTouchStart` handler

The dragging and release events are automatically handled for you.

## Table Options

### `enableColumnResizing`

```tsx
enableColumnResizing?: boolean
```

Enables/disables column resizing for \*all columns\*\*.

### `columnResizeMode`

```tsx
columnResizeMode?: 'onChange' | 'onEnd'
```

Determines when the columnSizing state is updated. `onChange` updates the state when the user is dragging the resize handle. `onEnd` updates the state when the user releases the resize handle.

### `columnResizeDirection`

```tsx
columnResizeDirection?: 'ltr' | 'rtl'
```

Enables or disables right-to-left support for resizing the column. defaults to 'ltr'.

### `onColumnSizingChange`

```tsx
onColumnSizingChange?: OnChangeFn<ColumnSizingState>
```

This optional function will be called when the columnSizing state changes. If you provide this function, you will be responsible for maintaining its state yourself. You can pass this state back to the table via the `state.columnSizing` table option.

### `onColumnSizingInfoChange`

```tsx
onColumnSizingInfoChange?: OnChangeFn<ColumnSizingInfoState>
```

This optional function will be called when the columnSizingInfo state changes. If you provide this function, you will be responsible for maintaining its state yourself. You can pass this state back to the table via the `state.columnSizingInfo` table option.

## Table API

### `setColumnSizing`

```tsx
setColumnSizing: (updater: Updater<ColumnSizingState>) => void
```

Sets the column sizing state using an updater function or a value. This will trigger the underlying `onColumnSizingChange` function if one is passed to the table options, otherwise the state will be managed automatically by the table.

### `setColumnSizingInfo`

```tsx
setColumnSizingInfo: (updater: Updater<ColumnSizingInfoState>) => void
```

Sets the column sizing info state using an updater function or a value. This will trigger the underlying `onColumnSizingInfoChange` function if one is passed to the table options, otherwise the state will be managed automatically by the table.

### `resetColumnSizing`

```tsx
resetColumnSizing: (defaultState?: boolean) => void
```

Resets column sizing to its initial state. If `defaultState` is `true`, the default state for the table will be used instead of the initialValue provided to the table.

### `resetHeaderSizeInfo`

```tsx
resetHeaderSizeInfo: (defaultState?: boolean) => void
```

Resets column sizing info to its initial state. If `defaultState` is `true`, the default state for the table will be used instead of the initialValue provided to the table.

### `getTotalSize`

```tsx
getTotalSize: () => number
```

Returns the total size of the table by calculating the sum of the sizes of all leaf-columns.

### `getLeftTotalSize`

```tsx
getLeftTotalSize: () => number
```

If pinning, returns the total size of the left portion of the table by calculating the sum of the sizes of all left leaf-columns.

### `getCenterTotalSize`

```tsx
getCenterTotalSize: () => number
```

If pinning, returns the total size of the center portion of the table by calculating the sum of the sizes of all unpinned/center leaf-columns.

### `getRightTotalSize`

```tsx
getRightTotalSize: () => number
```

If pinning, returns the total size of the right portion of the table by calculating the sum of the sizes of all right leaf-columns.
