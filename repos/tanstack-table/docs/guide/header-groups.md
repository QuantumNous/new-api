---
title: Header Groups Guide
---

## API

[Header Group API](../api/core/header-group)

## Header Groups Guide

This quick guide will discuss the different ways you can retrieve and interact with header group objects in TanStack Table.

### What are Header Groups?

Header Groups are simply "rows" of headers. Don't let the name confuse you, it's just that simple. The large majority of tables will only have one row of headers (a single header group), but if you define your column structure with nested columns as with the [Column Groups example](../framework/react/examples/column-groups), you can have multiple rows of headers (multiple header groups).

### Where to Get Header Groups From

There are multiple `table` instance APIs you can use to retrieve header groups from the table instance. `table.getHeaderGroups` is the most common API to use, but depending on the features that you are using, you may need to use other APIs, such as `table.get[Left/Center/Right]HeaderGroups` if you are using column pinning features.

### Header Group Objects

Header Group objects are similar to [Row](../guide/rows) objects, though simpler since there is not as much going on in header rows as there are in the body rows.

By default, header groups only have three properties:

- `id`: The unique identifier for the header group that is generated from its depth (index). This is useful as a key for React components.
- `depth`: The depth of the header group, zero-indexed based. Think of this as the row index amongst all header rows.
- `headers`: An array of [Header](../guide/headers) cell objects that belong to this header group (row).

### Access Header Cells

To render the header cells in a header group, you just map over the `headers` array from the header group object.

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
