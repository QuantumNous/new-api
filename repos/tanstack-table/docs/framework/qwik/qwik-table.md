---
title: Qwik Table
---

The `@tanstack/qwik-table` adapter is a wrapper around the core table logic. Most of it's job is related to managing state the "qwik" way, providing types and the rendering implementation of cell/header/footer templates.

## Exports

`@tanstack/qwik-table` re-exports all of `@tanstack/table-core`'s APIs and the following:

### `useQwikTable`

Takes an `options` object and returns a table from a Qwik Store with `NoSerialize`.

```ts
import { useQwikTable } from '@tanstack/qwik-table'

const table = useQwikTable(options)
// ...render your table

```

### `flexRender`

A utility function for rendering cell/header/footer templates with dynamic values.

Example:

```jsx
import { flexRender } from '@tanstack/qwik-table'
//...
return (
  <tbody>
    {table.getRowModel().rows.map(row => {
      return (
        <tr key={row.id}>
          {row.getVisibleCells().map(cell => (
            <td key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </tr>
      )
    })}
  </tbody>
);
```
