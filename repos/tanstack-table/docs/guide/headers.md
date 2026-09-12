---
title: Headers Guide
---

## API

[Header API](../api/core/header)

## Headers Guide

This quick guide will discuss the different ways you can retrieve and interact with `header` objects in TanStack Table.

Headers are the equivalent of cells, but meant for the `<thead>` section of the table instead of the `<tbody>` section.

### Where to Get Headers From

Headers come from [Header Groups](../guide/header-groups), which are the equivalent of rows, but meant for the `<thead>` section of the table instead of the `<tbody>` section.

#### HeaderGroup Headers

If you are in a header group, the headers are stored as an array in the `headerGroup.headers` property. Usually you will just map over this array to render your headers.

```jsx
<thead>
  {table.getHeaderGroups().map(headerGroup => {
    return (
      <tr key={headerGroup.id}>
        {headerGroup.headers.map(header => ( // map over the headerGroup headers array
          <th key={header.id} colSpan={header.colSpan}>
            {/* */}
          </th>
        ))}
      </tr>
    )
  })}
</thead>
```

#### Header Table Instance APIs

There are multiple `table` instance APIs that you can use to retrieve a list of headers depending on the features that you are using. The most common API you might use is `table.getFlatHeaders`, which will return a flat list of all headers in the table, but there are at least a dozen other headers that are useful in tandem with the column visibility and column pinning features. APIs like `table.getLeftLeafHeaders` or `table.getRightFlatHeaders` could be useful depending on your use case.

### Header Objects

Header objects are similar to [Cell](../guide/cells) objects, but meant for the `<thead>` section of the table instead of the `<tbody>` section. Every header object can be associated with a `<th>` or similar cell element in your UI. There are a few properties and methods on `header` objects that you can use to interact with the table state and extract cell values from the table based on the state of the table.

#### Header IDs

Every header object has an `id` property that makes it unique within the table instance. Usually you only need this `id` as a unique identifier for React keys or if you are following the [performant column resizing example](../framework/react/examples/column-resizing-performant).

For simple headers with no advanced nested or grouped headers logic, the `header.id` will be the same as it's parent `column.id`. However, if the header is part group column or a placeholder cell, it will have a more complicated id that is constructed from the header family, depth/header row index, column id, and header group id.

#### Nested Grouped Headers Properties

There are a few properties on `header` objects that are only useful if the header is part of a nested or grouped header structure. These properties include:

- `colspan`: The number of columns that the header should span. This is useful for rendering the `colSpan` attribute on the `<th>` element.
- `rowSpan`: The number of rows that the header should span. This is useful for rendering the `rowSpan` attribute on the `<th>` element. (Currently not implemented in default TanStack Table)
- `depth`: The header group "row index" that the header group belongs to.
- `isPlaceholder`: A boolean flag that is true if the header is a placeholder header. Placeholder headers are used to fill in the gaps when a column is hidden or when a column is part of a group column.
- `placeholderId`: The unique identifier for the placeholder header.
- `subHeaders`: The array of sub/child headers that belong to this header. Will be empty if the header is a leaf header.

> Note: `header.index` refers to its index within the header group (row of headers), i.e. its position from left to right. It is not the same as `header.depth`, which refers to the header group "row index".

#### Header Parent Objects

Every header stores a reference to its parent [column](../guide/columns) object and its parent [header group](../guide/header-groups) object.

### More Header APIs

Headers have a few more useful APIs attached to them that are useful for interacting with the table state. Most of them relate to the Column sizing and resizing features. See the [Column Sizing Guide](../guide/column-sizing) for more information.

### Header Rendering

Since the `header` column option you defined can be either a string, jsx, or a function returning either of those, the best way to render the headers is to use the `flexRender` utility from your adapter, which will handle all of those cases for you.

```jsx
{headerGroup.headers.map(header => (
  <th key={header.id} colSpan={header.colSpan}>
    {/* Handles all possible header column def scenarios for `header` */}
    {flexRender(header.column.columnDef.header, header.getContext())}
  </th>
))}
