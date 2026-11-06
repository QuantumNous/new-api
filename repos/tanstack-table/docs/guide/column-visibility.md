---
title: Column Visibility Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [column-visibility](../framework/react/examples/column-visibility)
- [column-ordering](../framework/react/examples/column-ordering)
- [sticky-column-pinning](../framework/react/examples/column-pinning-sticky)

### Other Examples

- [SolidJS column-visibility](../framework/solid/examples/column-visibility)
- [Svelte column-visibility](../framework/svelte/examples/column-visibility)

## API

[Column Visibility API](../api/features/column-visibility)

## Column Visibility Guide

The column visibility feature allows table columns to be hidden or shown dynamically. In previous versions of react-table, this feature was a static property on a column, but in v8, there is a dedicated `columnVisibility` state and APIs for managing column visibility dynamically.

### Column Visibility State

The `columnVisibility` state is a map of column IDs to boolean values. A column will be hidden if its ID is present in the map and the value is `false`. If the column ID is not present in the map, or the value is `true`, the column will be shown.

```jsx
const [columnVisibility, setColumnVisibility] = useState({
  columnId1: true,
  columnId2: false, //hide this column by default
  columnId3: true,
});

const table = useReactTable({
  //...
  state: {
    columnVisibility,
    //...
  },
  onColumnVisibilityChange: setColumnVisibility,
});
```

Alternatively, if you don't need to manage the column visibility state outside of the table, you can still set the initial default column visibility state using the `initialState` option.

> **Note**: If `columnVisibility` is provided to both `initialState` and `state`, the `state` initialization will take precedence and `initialState` will be ignored. Do not provide `columnVisibility` to both `initialState` and `state`, only one or the other.

```jsx
const table = useReactTable({
  //...
  initialState: {
    columnVisibility: {
      columnId1: true,
      columnId2: false, //hide this column by default
      columnId3: true,
    },
    //...
  },
});
```

### Disable Hiding Columns

By default, all columns can be hidden or shown. If you want to prevent certain columns from being hidden, you set the `enableHiding` column option to `false` for those columns.

```jsx
const columns = [
  {
    header: 'ID',
    accessorKey: 'id',
    enableHiding: false, // disable hiding for this column
  },
  {
    header: 'Name',
    accessor: 'name', // can be hidden
  },
];
```

### Column Visibility Toggle APIs

There are several column API methods that are useful for rendering column visibility toggles in the UI.

- `column.getCanHide` - Useful for disabling the visibility toggle for a column that has `enableHiding` set to `false`.
- `column.getIsVisible` - Useful for setting the initial state of the visibility toggle.
- `column.toggleVisibility` - Useful for toggling the visibility of a column.
- `column.getToggleVisibilityHandler` - Shortcut for hooking up the `column.toggleVisibility` method to a UI event handler.

```jsx
{table.getAllColumns().map((column) => (
  <label key={column.id}>
    <input
      checked={column.getIsVisible()}
      disabled={!column.getCanHide()}
      onChange={column.getToggleVisibilityHandler()}
      type="checkbox"
    />
    {column.columnDef.header}
  </label>
))}
```

### Column Visibility Aware Table APIs

When you render your header, body, and footer cells, there are a lot of API options available. You may see APIs like `table.getAllLeafColumns` and `row.getAllCells`, but if you use these APIs, they will not take column visibility into account. Instead, you need to use the "visible" variants of these APIs, such as `table.getVisibleLeafColumns` and `row.getVisibleCells`.

```jsx
<table>
  <thead>
    <tr>
      {table.getVisibleLeafColumns().map((column) => ( // takes column visibility into account
        //
      ))}
    </tr>
  </thead>
  <tbody>
    {table.getRowModel().rows.map((row) => (
      <tr key={row.id}>
        {row.getVisibleCells().map((cell) => ( // takes column visibility into account
          //
        ))}
      </tr>
    ))}
  </tbody>
</table>
```

If you are using the Header Group APIs, they will already take column visibility into account.
