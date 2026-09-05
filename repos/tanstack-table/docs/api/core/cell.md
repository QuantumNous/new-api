---
title: Cell APIs
---

These are **core** options and API properties for all cells. More options and API properties are available for other [table features](../guide/features).

## Cell API

All cell objects have the following properties:

### `id`

```tsx
id: string
```

The unique ID for the cell across the entire table.

### `getValue`

```tsx
getValue: () => any
```

Returns the value for the cell, accessed via the associated column's accessor key or accessor function.

### `renderValue`

```tsx
renderValue: () => any
```

Renders the value for a cell the same as `getValue`, but will return the `renderFallbackValue` if no value is found.

### `row`

```tsx
row: Row<TData>
```

The associated Row object for the cell.

### `column`

```tsx
column: Column<TData>
```

The associated Column object for the cell.

### `getContext`

```tsx
getContext: () => {
  table: Table<TData>
  column: Column<TData, TValue>
  row: Row<TData>
  cell: Cell<TData, TValue>
  getValue: <TTValue = TValue,>() => TTValue
  renderValue: <TTValue = TValue,>() => TTValue | null
}
```

Returns the rendering context (or props) for cell-based components like cells and aggregated cells. Use these props with your framework's `flexRender` utility to render these using the template of your choice:

```tsx
flexRender(cell.column.columnDef.cell, cell.getContext())
```
