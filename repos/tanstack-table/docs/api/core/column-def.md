---
title: ColumnDef APIs
---

Column definitions are plain objects with the following options:

## Options

### `id`

```tsx
id: string
```

The unique identifier for the column.

> 🧠 A column ID is optional when:
>
> - An accessor column is created with an object key accessor
> - The column header is defined as a string

### `accessorKey`

```tsx
accessorKey?: string & typeof TData
```

The key of the row object to use when extracting the value for the column.

### `accessorFn`

```tsx
accessorFn?: (originalRow: TData, index: number) => any
```

The accessor function to use when extracting the value for the column from each row.

### `columns`

```tsx
columns?: ColumnDef<TData>[]
```

The child column defs to include in a group column.

### `header`

```tsx
header?:
  | string
  | ((props: {
      table: Table<TData>
      header: Header<TData>
      column: Column<TData>
    }) => unknown)
```

The header to display for the column. If a string is passed, it can be used as a default for the column ID. If a function is passed, it will be passed a props object for the header and should return the rendered header value (the exact type depends on the adapter being used).

### `footer`

```tsx
footer?:
  | string
  | ((props: {
      table: Table<TData>
      header: Header<TData>
      column: Column<TData>
    }) => unknown)
```

The footer to display for the column. If a function is passed, it will be passed a props object for the footer and should return the rendered footer value (the exact type depends on the adapter being used).

### `cell`

```tsx
cell?:
  | string
  | ((props: {
      table: Table<TData>
      row: Row<TData>
      column: Column<TData>
      cell: Cell<TData>
      getValue: () => any
      renderValue: () => any
    }) => unknown)
```

The cell to display each row for the column. If a function is passed, it will be passed a props object for the cell and should return the rendered cell value (the exact type depends on the adapter being used).

### `meta`

```tsx
meta?: ColumnMeta // This interface is extensible via declaration merging. See below!
```

The meta data to be associated with the column. We can access it anywhere when the column is available via `column.columnDef.meta`. This type is global to all tables and can be extended like so:

```tsx
import '@tanstack/react-table' //or vue, svelte, solid, qwik, etc.

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    foo: string
  }
}
```
