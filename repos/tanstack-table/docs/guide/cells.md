---
title: Cells Guide
---

## API

[Cell API](../api/core/cell)

## Cells Guide

This quick guide will discuss the different ways you can retrieve and interact with `cell` objects in TanStack Table.

### Where to Get Cells From

Cells come from [Rows](../guide/rows). Enough said, right?

There are multiple `row` instance APIs you can use to retrieve the appropriate cells from a row depending on which features you are using. Most commonly, you will use the `row.getAllCells` or `row.getVisibleCells` APIs (if you are using column visibility features), but there are a handful of other similar APIs that you can use.

### Cell Objects

Every cell object can be associated with a `<td>` or similar cell element in your UI. There are a few properties and methods on `cell` objects that you can use to interact with the table state and extract cell values from the table based on the state of the table.

#### Cell IDs

Every cell object has an `id` property that makes it unique within the table instance. Each `cell.id` is constructed simply as a union of its parent row and column IDs separated by an underscore.

```js
{ id: `${row.id}_${column.id}` }
```

During grouping or aggregation features, the `cell.id` will have additional string appended to it.

#### Cell Parent Objects

Every cell stores a reference to its parent [row](../guide/rows) and [column](../guide/columns) objects.

#### Access Cell Values

The recommended way to access data values from a cell is to use either the `cell.getValue` or `cell.renderValue` APIs. Using either of these APIs will cache the results of the accessor functions and keep rendering efficient. The only difference between the two is that `cell.renderValue` will return either the value or the `renderFallbackValue` if the value is undefined, whereas `cell.getValue` will return the value or `undefined` if the value is undefined.

> Note: The `cell.getValue` and `cell.renderValue` APIs are shortcuts `row.getValue` and `row.renderValue` APIs, respectively.

```js
// Access data from any of the columns
const firstName = cell.getValue('firstName') // read the cell value from the firstName column
const renderedLastName = cell.renderValue('lastName') // render the value from the lastName column
```

#### Access Other Row Data from Any Cell

Since every cell object is associated with its parent row, you can access any data from the original row that you are using in your table using `cell.row.original`.

```js
// Even if we are in the scope of a different cell, we can still access the original row data
const firstName = cell.row.original.firstName // { firstName: 'John', lastName: 'Doe' }
```

### More Cell APIs

Depending on the features that you are using for your table, there are dozens more useful APIs for interacting with cells. See each features' respective API docs or guide for more information.

### Cell Rendering

You can just use the `cell.renderValue` or `cell.getValue` APIs to render the cells of your table. However, these APIs will only spit out the raw cell values (from accessor functions). If you are using the `cell: () => JSX` column definition options, you will want to use the `flexRender` API utility from your adapter.

Using the `flexRender` API will allow the cell to be rendered correctly with any extra markup or JSX and it will call the callback function with the correct parameters.

```jsx
import { flexRender } from '@tanstack/react-table'

const columns = [
  {
    accessorKey: 'fullName',
    cell: ({ cell, row }) => {
      return <div><strong>{row.original.firstName}</strong> {row.original.lastName}</div>
    }
    //...
  }
]
//...
<tr>
  {row.getVisibleCells().map(cell => {
    return <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
  })}
</tr>
