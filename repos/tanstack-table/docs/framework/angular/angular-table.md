---
title: Angular Table
---

The `@tanstack/angular-table` adapter is a wrapper around the core table logic. Most of it's job is related to managing
state the "angular signals" way, providing types and the rendering implementation of cell/header/footer templates.

## Exports

`@tanstack/angular-table` re-exports all of `@tanstack/table-core`'s APIs and the following:

### `createAngularTable`

Accepts an options function or a computed value that returns the table options, and returns a table.

```ts
import {createAngularTable} from '@tanstack/angular-table'

export class AppComponent {
  data = signal<Person[]>([])

  table = createAngularTable(() => ({
    data: this.data(),
    columns: defaultColumns,
    getCoreRowModel: getCoreRowModel(),
  }))
}

// ...render your table in template

```

### `FlexRender`

An Angular structural directive for rendering cell/header/footer templates with dynamic values.

FlexRender supports any type of content supported by Angular:

- A string, or a html string via `innerHTML`
- A [TemplateRef](https://angular.dev/api/core/TemplateRef)
- A [Component](https://angular.dev/api/core/Component) wrapped into `FlexRenderComponent`

You can just use the `cell.renderValue` or `cell.getValue` APIs to render the cells of your table. However,
these APIs will only spit out the raw cell values (from accessor functions).
If you are using the `cell: () => any` column definition options, you will want to use the `FlexRenderDirective` from the adapter.

Cell column definition is **reactive** and runs into an **injection context**, then you can inject services or make use of signals to automatically modify the rendered content.

#### Example

```ts
@Component({
  imports: [FlexRenderDirective],
  //...
})
class YourComponent {}
```

```angular-html

<tbody>
@for (row of table.getRowModel().rows; track row.id) {
  <tr>
    @for (cell of row.getVisibleCells(); track cell.id) {
      <td>
        <ng-container
          *flexRender="
              cell.column.columnDef.cell;
              props: cell.getContext();
              let cell
            "
        >
          <!-- if you want to render a simple string -->
          {{ cell }}
          <!-- if you want to render an html string -->
          <div [innerHTML]="cell"></div>
        </ng-container>
      </td>
    }
  </tr>
}
</tbody>
```

#### Rendering a Component

To render a Component into a specific column header/cell/footer, you can pass a `FlexRenderComponent` instantiated with
your `ComponentType, with the ability to include parameters such as inputs, outputs and a custom injector.

```ts
import {flexRenderComponent} from "./flex-render-component";
import {ChangeDetectionStrategy, input, output} from "@angular/core";

@Component({
  template: `
    ...
  `,
  standalone: true,
  changeDetectionStrategy: ChangeDetectionStrategy.OnPush,
  host: {
    '(click)': 'clickEvent.emit($event)'
  }
})
class CustomCell {
  readonly content = input.required<string>();
  readonly cellType = input<MyType>();

  // An output that will emit for every cell click
  readonly clickEvent = output<Event>();
}

class AppComponent {
  columns: ColumnDef<unknown>[] = [
    {
      id: 'custom-cell',
      header: () => {
        const translateService = inject(TranslateService);
        return translateService.translate('...');
      },
      cell: (context) => {
        return flexRenderComponent(
          MyCustomComponent,
          {
            injector, // Optional injector
            inputs: {
              // Mandatory input since we are using `input.required()
              content: context.row.original.rowProperty,
              // cellType? - Optional input
            },
            outputs: {
              clickEvent: () => {
                // Do something
              }
            }
          }
        )
      },
    },
  ]
}
```

Underneath, this utilizes
the [ViewContainerRef#createComponent](https://angular.dev/api/core/ViewContainerRef#createComponent) api.
Therefore, you should declare your custom inputs using the @Input decorator or input/model signals.

You can still access the table cell context through the `injectFlexRenderContext` function, which returns the context
value based on the props you pass to the `FlexRenderDirective`.

```ts

@Component({
  // ...
})
class CustomCellComponent {
  // context of a cell component
  readonly context = injectFlexRenderContext<CellContext<TData, TValue>>();
  // context of a header/footer component
  readonly context = injectFlexRenderContext<HeaderContext<TData, TValue>>();
}
```

Alternatively, you can render a component into a specific column header, cell, or footer by passing the component type
to the corresponding column definitions. These column definitions will be provided to the `flexRender` directive along
with the `context`.

```ts
class AppComponent {
  columns: ColumnDef<Person>[] = [
    {
      id: 'select',
      header: () => TableHeadSelectionComponent<Person>,
      cell: () => TableRowSelectionComponent<Person>,
    },
  ]
}
```

```angular-html
<ng-container
  *flexRender="
    header.column.columnDef.header;
    props: header.getContext();
    let headerCell
  "
>
  {{ headerCell }}
</ng-container>
```

Properties of `context` provided in the `flexRender` directive will be accessible to your component.
You can explicitly define the context properties required by your component.
In this example, the context provided to flexRender is of type HeaderContext.
Input signal `table`, which is a property of HeaderContext together with `column` and `header` properties,
is then defined to be used in the component. If any of the context properties are
needed in your component, feel free to use them. Please take note that only input signal is supported,
when defining access to context properties, using this approach.

```angular-ts
@Component({
  template: `
    <input
      type="checkbox"
      [checked]="table().getIsAllRowsSelected()"
      [indeterminate]="table().getIsSomeRowsSelected()"
      (change)="table().toggleAllRowsSelected()"
    />
  `,
  // ...
})
export class TableHeadSelectionComponent<T> {
  //column = input.required<Column<T, unknown>>()
  //header = input.required<Header<T, unknown>>()
  table = input.required<Table<T>>()
}
```

#### Rendering a TemplateRef

In order to render a TemplateRef into a specific column header/cell/footer, you can pass the TemplateRef into the column
definition.

You can access the TemplateRef data via the `$implicit` property, which is valued based on what is passed in the props
field of flexRender.

In most cases, each TemplateRef will be rendered with the $implicit context valued based on the cell type in this way:

- Header: `HeaderContext<T, ?>`
- Cell: `CellContext<T, ?>`,
- Footer: `HeaderContext<T, ?>`

```angular-html

<ng-container
  *flexRender="
              cell.column.columnDef.cell;
              props: cell.getContext();
              let cell
            "
>
  <!-- if you want to render a simple string -->
  {{ cell }}
  <!-- if you want to render an html string -->
  <div [innerHTML]="cell"></div>
</ng-container>

<ng-template #myCell let-context>
  <!-- render something with context -->
</ng-template>
```

Full example:

```angular-ts
import type {
  CellContext,
  ColumnDef,
  HeaderContext,
} from '@tanstack/angular-table'
import {Component, TemplateRef, viewChild} from '@angular/core'

@Component({
  template: `
    <tbody>
      @for (row of table.getRowModel().rows; track row.id) {
        <tr>
          @for (cell of row.getVisibleCells(); track cell.id) {
            <td>
              <ng-container
                *flexRender="
                  cell.column.columnDef.cell;
                  props: cell.getContext(); // Data given to the TemplateRef
                  let cell
                "
              >
                <!-- if you want to render a simple string -->
                {{ cell }}
                <!-- if you want to render an html string -->
                <div [innerHTML]="cell"></div>
              </ng-container>
            </td>
          }
        </tr>
      }
    </tbody>

    <ng-template #customHeader let-context>
      {{ context.getValue() }}
    </ng-template>
    <ng-template #customCell let-context>
      {{ context.getValue() }}
    </ng-template>
  `,
})
class AppComponent {
  customHeader =
    viewChild.required<TemplateRef<{ $implicit: HeaderContext<any, any> }>>(
      'customHeader'
    )
  customCell =
    viewChild.required<TemplateRef<{ $implicit: CellContext<any, any> }>>(
      'customCell'
    )

  columns: ColumnDef<unknown>[] = [
    {
      id: 'customCell',
      header: () => this.customHeader(),
      cell: () => this.customCell(),
    },
  ]
}
```
