---
title: Row Models Guide
---

## Row Models Guide

If you take a look at the most basic example of TanStack Table, you'll see a code snippet like this:

```ts
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'

function Component() {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(), //row model
  })
}
```

What is this `getCoreRowModel` function? And why do you have to import it from TanStack Table only to just pass it back to itself?

Well, the answer is that TanStack Table is a modular library. Not all code for every single feature is included in the createTable functions/hooks by default. You only need to import and include the code that you will need to correctly generate rows based on the features you want to use.

### What are Row Models?

Row models run under the hood of TanStack Table to transform your original data in useful ways that are needed for data grid features like filtering, sorting, grouping, expanding, and pagination. The rows that get generated and render on screen won't necessarily be a 1:1 mapping of the original data that you passed to the table. They may be sorted, filtered, paginated, etc.

### Import Row Models

You should only import the row models that you need. Here are all of the row models that are available:

```ts
//only import the row models you need
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
}
//...
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getFacetedMinMaxValues: getFacetedMinMaxValues(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  getFilteredRowModel: getFilteredRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
})
```

### Customize/Fork Row Models

You don't have to use the exact row models that are provided by TanStack Table. If you need some advanced customization for certain row models, feel free to copy the [source code](https://github.com/TanStack/table/tree/main/packages/table-core/src/utils) for the row model you want to customize and modify it to your needs.

### Using Row Models

Once your table instance has been created, you can access all of the row models that you may need directly from the table instance. There are even more derived row models available apart from the ones that you may have imported.

For normal rendering use cases, you will probably only need to use the `table.getRowModel()` method, as this row model will use all/any of the other row models depending on which features you have enabled or disabled. All of the other row models are available for you to "dig into" some of the underlying data transformations that are happening in the table.

### Available Row Models on Table Instance

- **`getRowModel`** - This is the main row model that you should use for rendering your table rows markup. It will use all of the other row models to generate the final row model that you will use to render your table rows.

- `getCoreRowModel` - returns a basic row model that is just a 1:1 mapping of the original data passed to the table.

- `getFilteredRowModel` - returns a row model that accounts for column filtering and global filtering.
- `getPreFilteredRowModel` - returns a row model before column filtering and global filtering are applied.

- `getGroupedRowModel` - returns a row model that applies grouping and aggregation to the data and creates sub-rows.
- `getPreGroupedRowModel` - returns a row model before grouping and aggregation are applied.

- `getSortedRowModel` - returns a row model that has had sorting applied to it.
- `getPreSortedRowModel` - returns a row model before sorting is applied (rows are in original order).

- `getExpandedRowModel` - returns a row model that accounts for expanded/hidden sub-rows.
- `getPreExpandedRowModel` - returns a row model that only includes root level rows with no expanded sub-rows included. Still includes sorting.

- `getPaginationRowModel` - returns a row model that only includes the rows that should be displayed on the current page based on the pagination state.
- `getPrePaginationRowModel` - returns a row model without pagination applied (includes all rows).

- `getSelectedRowModel` - returns a row model of all selected rows (but only based on the data that was passed to the table). Runs after getCoreRowModel.
- `getPreSelectedRowModel` - returns a row model before row selection is applied (Just returns getCoreRowModel).
- `getGroupedSelectedRowModel` - returns a row model of selected rows after grouping. Runs after getSortedRowModel, which runs after getGroupedRowModel, which runs after getFilteredRowModel.
- `getFilteredSelectedRowModel` - returns a row model of selected rows after column filtering and global filtering. Runs after getFilteredRowModel.

### The Order of Row Model Execution

Knowing how TanStack Table processes rows internally can help you gain a better understanding of what is happening under the hood, and help you debug any issues you may encounter.

Internally, this is the order in which each of the row models are applied to the data, if their respective features are enabled:

`getCoreRowModel` -> `getFilteredRowModel` -> `getGroupedRowModel` -> `getSortedRowModel` -> `getExpandedRowModel` -> `getPaginationRowModel` -> `getRowModel`

If in any case the respective feature is disabled or turned off with a `"manual*"` table option, the `getPre*RowModel` will be used instead in that step of the process.

As you can see above, first the data is filtered, then grouped, then sorted, then expanded, and then finally paginated as the final step.

### Row Model Data Structure

Each row model will provide you the rows in 3 different useful formats:

1. `rows` - An array of rows.
2. `flatRows` - An array of rows, but all sub-rows are flattened into the top level.
3. `rowsById` - An object of rows, where each row is keyed by its `id`. This is useful for quickly looking up rows by their `id` with better performance.

```ts
console.log(table.getRowModel().rows) // array of rows
console.log(table.getRowModel().flatRows) // array of rows, but all sub-rows are flattened into the top level
console.log(table.getRowModel().rowsById['row-id']) // object of rows, where each row is keyed by its `id`
```