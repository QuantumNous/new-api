---
title: Pagination Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [pagination](../framework/react/examples/pagination)
- [pagination-controlled (React Query)](../framework/react/examples/pagination-controlled)
- [editable-data](../framework/react/examples/editable-data)
- [expanding](../framework/react/examples/expanding)
- [filters](../framework/react/examples/filters)
- [fully-controlled](../framework/react/examples/fully-controlled)
- [row-selection](../framework/react/examples/row-selection)

## API

[Pagination API](../api/features/pagination)

## Pagination Guide

TanStack Table has great support for both client-side and server-side pagination. This guide will walk you through the different ways to implement pagination in your table.

### Client-Side Pagination

Using client-side pagination means that the `data` that you fetch will contain ***ALL*** of the rows for the table, and the table instance will handle pagination logic in the front-end.

#### Should You Use Client-Side Pagination?

Client-side pagination is usually the simplest way to implement pagination when using TanStack Table, but it might not be practical for very large datasets.

However, a lot of people underestimate just how much data can be handled client-side. If your table will only ever have a few thousand rows or less, client-side pagination can still be a viable option. TanStack Table is designed to scale up to 10s of thousands of rows with decent performance for pagination, filtering, sorting, and grouping. The [official pagination example](../framework/react/examples/pagination) loads 100,000 rows and still performs well, albeit with only handful of columns.

Every use-case is different and will depend on the complexity of the table, how many columns you have, how large every piece of data is, etc. The main bottlenecks to pay attention to are:

1. Can your server query all of the data in a reasonable amount of time (and cost)?
2. What is the total size of the fetch? (This might not scale as badly as you think if you don't have many columns.)
3. Is the client's browser using too much memory if all of the data is loaded at once?

If you're not sure, you can always start with client-side pagination and then switch to server-side pagination in the future as your data grows.

#### Should You Use Virtualization Instead?

Alternatively, instead of paginating the data, you can render all rows of a large dataset on the same page, but only use the browser's resources to render the rows that are visible in the viewport. This strategy is often called "virtualization" or "windowing". TanStack offers a virtualization library called [TanStack Virtual](https://tanstack.com/virtual/latest) that can work well with TanStack Table. The UI/UX of both virtualization and pagination have their own trade-offs, so see which one works best for your use-case.

#### Pagination Row Model

If you want to take advantage of the built-in client-side pagination in TanStack Table, you first need to pass in the pagination row model.

```jsx
import { useReactTable, getCoreRowModel, getPaginationRowModel } from '@tanstack/react-table';
//...
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(), //load client-side pagination code
});
```

### Manual Server-Side Pagination

If you decide that you need to use server-side pagination, here is how you can implement it.

No pagination row model is needed for server-side pagination, but if you have provided it for other tables that do need it in a shared component, you can still turn off the client-side pagination by setting the `manualPagination` option to `true`. Setting the `manualPagination` option to `true` will tell the table instance to use the `table.getPrePaginationRowModel` row model under the hood, and it will make the table instance assume that the `data` that you pass in is already paginated.

#### Page Count and Row Count

The table instance will have no way of knowing how many rows/pages there are in total in your back-end unless you tell it. Provide either the `rowCount` or `pageCount` table option to let the table instance know how many pages there are in total. If you provide a `rowCount`, the table instance will calculate the `pageCount` internally from `rowCount` and `pageSize`. Otherwise, you can directly provide the `pageCount` if you already have it. If you don't know the page count, you can just pass in `-1` for the `pageCount`, but the `getCanNextPage` and `getCanPreviousPage` row model functions will always return `true` in this case.

```jsx
import { useReactTable, getCoreRowModel, getPaginationRowModel } from '@tanstack/react-table';
//...
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  // getPaginationRowModel: getPaginationRowModel(), //not needed for server-side pagination
  manualPagination: true, //turn off client-side pagination
  rowCount: dataQuery.data?.rowCount, //pass in the total row count so the table knows how many pages there are (pageCount calculated internally if not provided)
  // pageCount: dataQuery.data?.pageCount, //alternatively directly pass in pageCount instead of rowCount
});
```

> **Note**: Setting the `manualPagination` option to `true` will make the table instance assume that the `data` that you pass in is already paginated.

### Pagination State

Whether or not you are using client-side or manual server-side pagination, you can use the built-in `pagination` state and APIs.

The `pagination` state is an object that contains the following properties:

- `pageIndex`: The current page index (zero-based).
- `pageSize`: The current page size.

You can manage the `pagination` state just like any other state in the table instance.

```jsx
import { useReactTable, getCoreRowModel, getPaginationRowModel } from '@tanstack/react-table';
//...
const [pagination, setPagination] = useState({
  pageIndex: 0, //initial page index
  pageSize: 10, //default page size
});

const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  onPaginationChange: setPagination, //update the pagination state when internal APIs mutate the pagination state
  state: {
    //...
    pagination,
  },
});
```

Alternatively, if you have no need for managing the `pagination` state in your own scope, but you need to set different initial values for the `pageIndex` and `pageSize`, you can use the `initialState` option.

```jsx
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: {
    pagination: {
      pageIndex: 2, //custom initial page index
      pageSize: 25, //custom default page size
    },
  },
});
```

> **Note**: Do NOT pass the `pagination` state to both the `state` and `initialState` options. `state` will overwrite `initialState`. Only use one or the other.

### Pagination Options

Besides the `manualPagination`, `pageCount`, and `rowCount` options which are useful for manual server-side pagination (and discussed [above](#manual-server-side-pagination)), there is one other table option that is useful to understand.

#### Auto Reset Page Index

By default, `pageIndex` is reset to `0` when page-altering state changes occur, such as when the `data` is updated, filters change, grouping changes, etc. This behavior is automatically disabled when `manualPagination` is true but it can be overridden by explicitly assigning a boolean value to the `autoResetPageIndex` table option.

```jsx
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  autoResetPageIndex: false, //turn off auto reset of pageIndex
});
```

Be aware, however, that if you turn off `autoResetPageIndex`, you may need to add some logic to handle resetting the `pageIndex` yourself to avoid showing empty pages.

### Pagination APIs

There are several pagination table instance APIs that are useful for hooking up your pagination UI components.

#### Pagination Button APIs

- `getCanPreviousPage`: Useful for disabling the "previous page" button when on the first page.
- `getCanNextPage`: Useful for disabling the "next page" button when there are no more pages.
- `previousPage`: Useful for going to the previous page. (Button click handler)
- `nextPage`: Useful for going to the next page. (Button click handler)
- `firstPage`: Useful for going to the first page. (Button click handler)
- `lastPage`: Useful for going to the last page. (Button click handler)
- `setPageIndex`: Useful for a "go to page" input.
- `resetPageIndex`: Useful for resetting the table state to the original page index.
- `setPageSize`: Useful for a "page size" input/select.
- `resetPageSize`: Useful for resetting the table state to the original page size.
- `setPagination`: Useful for setting all of the pagination state at once.
- `resetPagination`: Useful for resetting the table state to the original pagination state.

> **Note**: Some of these APIs are new in `v8.13.0`.

```jsx
<Button
  onClick={() => table.firstPage()}
  disabled={!table.getCanPreviousPage()}
>
  {'<<'}
</Button>
<Button
  onClick={() => table.previousPage()}
  disabled={!table.getCanPreviousPage()}
>
  {'<'}
</Button>
<Button
  onClick={() => table.nextPage()}
  disabled={!table.getCanNextPage()}
>
  {'>'}
</Button>
<Button
  onClick={() => table.lastPage()}
  disabled={!table.getCanNextPage()}
>
  {'>>'}
</Button>
<select
  value={table.getState().pagination.pageSize}
  onChange={e => {
    table.setPageSize(Number(e.target.value))
  }}
>
  {[10, 20, 30, 40, 50].map(pageSize => (
    <option key={pageSize} value={pageSize}>
      {pageSize}
    </option>
  ))}
</select>
```

#### Pagination Info APIs

- `getPageCount`: Useful for showing the total number of pages.
- `getRowCount`: Useful for showing the total number of rows.
