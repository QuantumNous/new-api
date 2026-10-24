---
title: Expanding Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [expanding](../framework/react/examples/expanding)
- [grouping](../framework/react/examples/grouping)
- [sub-components](../framework/react/examples/sub-components)

## API

[Expanding API](../api/features/expanding)

## Expanding Feature Guide

Expanding is a feature that allows you to show and hide additional rows of data related to a specific row. This can be useful in cases where you have hierarchical data and you want to allow users to drill down into the data from a higher level. Or it can be useful for showing additional information related to a row.

### Different use cases for Expanding Features

There are multiple use cases for expanding features in TanStack Table that will be discussed below.

1. Expanding sub-rows (child rows, aggregate rows, etc.)
2. Expanding custom UI (detail panels, sub-tables, etc.)

### Enable Client-Side Expanding

To use the client-side expanding features, you need to define the getExpandedRowModel function in your table options. This function is responsible for returning the expanded row model.

```ts
const table = useReactTable({
  // other options...
  getExpandedRowModel: getExpandedRowModel(),
})
```

Expanded data can either contain table rows or any other data you want to display. We will discuss how to handle both cases in this guide.

### Table rows as expanded data

Expanded rows are essentially child rows that inherit the same column structure as their parent rows. If your data object already includes these expanded rows data, you can utilize the `getSubRows` function to specify these child rows. However, if your data object does not contain the expanded rows data, they can be treated as custom expanded data, which is discussed in next section.

For example, if you have a data object like this:

```ts
type Person = {
  id: number
  name: string
  age: number
  children?: Person[] | undefined
}

const data: Person[] =  [
  { id: 1, 
  name: 'John', 
  age: 30, 
  children: [
      { id: 2, name: 'Jane', age: 5 },
      { id: 5, name: 'Jim', age: 10 }
    ] 
  },
  { id: 3,
   name: 'Doe', 
   age: 40, 
    children: [
      { id: 4, name: 'Alice', age: 10 }
    ] 
  },
]
```

Then you can use the getSubRows function to return the children array in each row as expanded rows. The table instance will now understand where to look for the sub rows on each row.

```ts
const table = useReactTable({
  // other options...
  getSubRows: (row) => row.children, // return the children array as sub-rows
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
})
```

> **Note:** You can have a complicated `getSubRows` function, but keep in mind that it will run for every row and every sub-row. This can be expensive if the function is not optimized. Async functions are not supported.

### Custom Expanding UI

In some cases, you may wish to show extra details or information, which may or may not be part of your table data object, such as expanded data for rows. This kind of expanding row UI has gone by many names over the years including "expandable rows", "detail panels", "sub-components", etc.

By default, the `row.getCanExpand()` row instance API will return false unless it finds `subRows` on a row. This can be overridden by implementing your own `getRowCanExpand` function in the table instance options.

```ts
//...
const table = useReactTable({
  // other options...
  getRowCanExpand: (row) => true, // Add your logic to determine if a row can be expanded. True means all rows include expanded data
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
})
//...
<tbody>
  {table.getRowModel().rows.map((row) => (
    <React.Fragment key={row.id}>
     {/* Normal row UI */}
      <tr>
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id}>
            <FlexRender
              render={cell.column.columnDef.cell}
              props={cell.getContext()}
            />
          </td>
        ))}
      </tr>
      {/* If the row is expanded, render the expanded UI as a separate row with a single cell that spans the width of the table */}
      {row.getIsExpanded() && (
        <tr>
          <td colSpan={row.getAllCells().length}> // The number of columns you wish to span for the expanded data if it is not a row that shares the same columns as the parent row
            // Your custom UI goes here
          </td>
        </tr>
      )}
    </React.Fragment>
  ))}
</tbody>
//...
```

### Expanded rows state

If you need to control the expanded state of the rows in your table, you can do so by using the expanded state and the `onExpandedChange` option. This allows you to manage the expanded state according to your requirements.

```ts
const [expanded, setExpanded] = useState<ExpandedState>({})

const table = useReactTable({
  // other options...
  state: {
    expanded: expanded, // must pass expanded state back to the table
  },
  onExpandedChange: setExpanded
})
```

The ExpandedState type is defined as follows:

```ts
type ExpandedState = true | Record<string, boolean>
```

If the ExpandedState is true, it means all rows are expanded. If it's a record, only the rows with IDs present as keys in the record and have their value set to true are expanded.  For example, if the expanded state is { row1: true, row2: false }, it means the row with ID row1 is expanded and the row with ID row2 is not expanded. This state is used by the table to determine which rows are expanded and should display their subRows, if any.

### UI toggling handler for expanded rows

TanStack table will not add a toggling handler UI for expanded data to your table. You should manually add it within each row's UI to allow users to expand and collapse the row. For example, you can add a button UI within the columns definition.

```ts
const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'age',
    header: 'Age',
  },
  {
    header: 'Children',
    cell: ({ row }) => {
      return row.getCanExpand() ?
        <button
          onClick={row.getToggleExpandedHandler()}
          style={{ cursor: 'pointer' }}
        >
        {row.getIsExpanded() ? '👇' : '👉'}
        </button>
       : '';
    },
  },
]
```

### Filtering Expanded Rows

By default, the filtering process starts from the parent rows and moves downwards. This means if a parent row is excluded by the filter, all its child rows will also be excluded. However, you can change this behavior by using the `filterFromLeafRows` option. When this option is enabled, the filtering process starts from the leaf (child) rows and moves upwards. This ensures that a parent row will be included in the filtered results as long as at least one of its child or grandchild rows meets the filter criteria. Additionally, you can control how deep into the child hierarchy the filter process goes by using the `maxLeafRowFilterDepth` option. This option allows you to specify the maximum depth of child rows that the filter should consider.

```ts
//...
const table = useReactTable({
  // other options...
  getSubRows: row => row.subRows,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  filterFromLeafRows: true, // search through the expanded rows
  maxLeafRowFilterDepth: 1, // limit the depth of the expanded rows that are searched
})
```

### Paginating Expanded Rows

By default, expanded rows are paginated along with the rest of the table (which means expanded rows may span multiple pages). If you want to disable this behavior (which means expanded rows will always render on their parents page. This also means more rows will be rendered than the set page size) you can use the `paginateExpandedRows` option.

```ts
const table = useReactTable({
  // other options...
  paginateExpandedRows: false,
})
```

### Pinning Expanded Rows

Pinning expanded rows works the same way as pinning regular rows. You can pin expanded rows to the top or bottom of the table. Please refer to the [Pinning Guide](./pinning.md) for more information on row pinning.

### Sorting Expanded Rows

By default, expanded rows are sorted along with the rest of the table.

### Manual Expanding (server-side)

If you are doing server-side expansion, you can enable manual row expansion by setting the manualExpanding option to true. This means that the `getExpandedRowModel` will not be used to expand rows and you would be expected to perform the expansion in your own data model.

```ts
const table = useReactTable({
  // other options...
  manualExpanding: true,
})
```
