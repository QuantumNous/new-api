---
title: Rows Guide
---

## API

[Row API](../api/core/row)

## Rows Guide

This quick guide will discuss the different ways you can retrieve and interact with row objects in TanStack Table.

### Where to Get Rows From

There are multiple `table` instance APIs you can use to retrieve rows from the table instance.

#### table.getRow

If you need to access a specific row by its `id`, you can use the `table.getRow` table instance API.

```js
const row = table.getRow(rowId)
```

#### Row Models

The `table` instance generates `row` objects and stores them in useful arrays called ["Row Models"](../guide/row-models). This is discussed in much more detail in the [Row Models Guide](../guide/row-models), but here are the most common ways you may access the row models.

##### Render Rows

```jsx
<tbody>
  {table.getRowModel().rows.map(row => (
    <tr key={row.id}>
     {/* ... */}
    </tr>
  ))}
</tbody>
```

##### Get Selected Rows

```js
const selectedRows = table.getSelectedRowModel().rows
```

### Row Objects

Every row object contains row data and many APIs to either interact with the table state or extract cells from the row based on the state of the table.

#### Row IDs

Every row object has an `id` property that makes it unique within the table instance. By default the `row.id` is the same as the `row.index` that is created in the row model. However, it can be useful to override each row's `id` with a unique identifier from the row's data. You can use the `getRowId` table option to do this.

```js
const table = useReactTable({
  columns,
  data,
  getRowId: originalRow => originalRow.uuid, //override the row.id with the uuid from the original row's data
})
```

> Note: In some features like grouping and expanding, the `row.id` will have additional string appended to it.

#### Access Row Values

The recommended way to access data values from a row is to use either the `row.getValue` or `row.renderValue` APIs. Using either of these APIs will cache the results of the accessor functions and keep rendering efficient. The only difference between the two is that `row.renderValue` will return either the value or the `renderFallbackValue` if the value is undefined, whereas `row.getValue` will return the value or `undefined` if the value is undefined.

```js
// Access data from any of the columns
const firstName = row.getValue('firstName') // read the row value from the firstName column
const renderedLastName = row.renderValue('lastName') // render the value from the lastName column
```

> Note: `cell.getValue` and `cell.renderValue` are shortcuts for the `row.getValue` and `row.renderValue` APIs, respectively.

#### Access Original Row Data

For every row object, you can access the original corresponding `data` that was passed to the table instance via the `row.original` property. None of the data in the `row.original` will have been modified by the accessors in your column definitions, so if you were doing any sort of data transformations in your accessors, those will not be reflected in the `row.original` object.

```js
// Access any data from the original row
const firstName = row.original.firstName // { firstName: 'John', lastName: 'Doe' }
```

### Sub Rows

If you are using either grouping or expanding features, your rows may contain sub-rows or parent row references. This is discussed in much more detail in the [Expanding Guide](../guide/expanding), but here is a quick overview of useful properties and methods for working with sub-rows.

- `row.subRows`: An array of sub-rows for the row.
- `row.depth`: The depth of the row (if nested or grouped) relative to the root row array. 0 for root level rows, 1 for child rows, 2 for grandchild rows, etc.
- `row.parentId`: The unique ID of the parent row for the row (The row that contains this row in its subRows array).
- `row.getParentRow`: Returns the parent row for the row, if it exists.

### More Row APIs

Depending on the features that you are using for your table, there are dozens more useful APIs for interacting with rows. See each features' respective API docs or guide for more information.
