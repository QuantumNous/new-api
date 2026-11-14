---
title: Lit Table
---

The `@tanstack/lit-table` adapter is a wrapper around the core table logic. Most of it's job is related to managing state the "lit" way, providing types and the rendering implementation of cell/header/footer templates.

## Exports

`@tanstack/lit-table` re-exports all of `@tanstack/table-core`'s APIs and the following:

### `TableController`

Is a reactive controller that provides a `table` API that takes an `options` object and returns a table instance.

```ts
import { TableController } from '@tanstack/lit-table'

@customElement('my-table-element')
class MyTableElement extends LitElement {
  private tableController = new TableController<Person>(this)

  protected render() {
    const table = this.tableController.table(options)
    // ...render your table
  }
}
```

### `flexRender`

A utility function for rendering cell/header/footer templates with dynamic values.

Example:

```jsx
import { flexRender } from '@tanstack/lit-table'
//...
return html`
<tbody>
  ${table
    .getRowModel()
    .rows.slice(0, 10)
    .map(
      row => html`
        <tr>
          ${row
            .getVisibleCells()
            .map(
              cell => html`
                <td>
                  ${flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                </td>
              `
            )}
        </tr>
      `
    )}
</tbody>
`
```
