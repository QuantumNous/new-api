---
title: Column APIs
---

These are **core** options and API properties for all columns. More options and API properties are available for other [table features](../guide/features).

## Column API

All column objects have the following properties:

### `id`

```tsx
id: string
```

The resolved unique identifier for the column resolved in this priority:

- A manual `id` property from the column def
- The accessor key from the column def
- The header string from the column def

### `depth`

```tsx
depth: number
```

The depth of the column (if grouped) relative to the root column def array.

### `accessorFn`

```tsx
accessorFn?: AccessorFn<TData>
```

The resolved accessor function to use when extracting the value for the column from each row. Will only be defined if the column def has a valid accessor key or function defined.

### `columnDef`

```tsx
columnDef: ColumnDef<TData>
```

The original column def used to create the column.

### `columns`

```tsx
type columns = ColumnDef<TData>[]
```

The child column (if the column is a group column). Will be an empty array if the column is not a group column.

### `parent`

```tsx
parent?: Column<TData>
```

The parent column for this column. Will be undefined if this is a root column.

### `getFlatColumns`

```tsx
type getFlatColumns = () => Column<TData>[]
```

Returns the flattened array of this column and all child/grand-child columns for this column.

### `getLeafColumns`

```tsx
type getLeafColumns = () => Column<TData>[]
```

Returns an array of all leaf-node columns for this column. If a column has no children, it is considered the only leaf-node column.
